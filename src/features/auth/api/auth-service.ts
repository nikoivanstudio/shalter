import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"

import { prisma } from "@/shared/lib/db/prisma"
import { env } from "@/shared/config/env"
import { sendRecoveryCodeEmail } from "@/shared/lib/mail"
import { ADMIN_ROLE, USER_ROLE } from "@/shared/lib/auth/roles"

async function resolveInitialRole(email: string) {
  const elevatedUsersCount = await prisma.user.count({
    where: {
      role: {
        in: [ADMIN_ROLE],
      },
    },
  })

  if (elevatedUsersCount > 0) {
    return USER_ROLE
  }

  if (env.BOOTSTRAP_ADMIN_EMAIL) {
    return email === env.BOOTSTRAP_ADMIN_EMAIL ? ADMIN_ROLE : USER_ROLE
  }

  return ADMIN_ROLE
}

type AuthResult =
  | { ok: true; user: { id: number; email: string } }
  | {
      ok: false
      status: number
      message: string
      fieldErrors?: Record<string, string[]>
    }

async function clearUserAccountData(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      dialogs: {
        select: {
          id: true,
          ownerId: true,
          users: {
            select: { id: true },
            orderBy: { id: "asc" },
          },
        },
      },
    },
  })

  if (!user) {
    return false
  }

  await prisma.$transaction(async (tx) => {
    await tx.contact.deleteMany({
      where: { ownerId: userId },
    })

    await tx.userBlacklist.deleteMany({
      where: { ownerId: userId },
    })

    for (const dialog of user.dialogs) {
      const remainingUserIds = dialog.users
        .map((item) => item.id)
        .filter((id) => id !== user.id)

      if (remainingUserIds.length === 0) {
        await tx.message.deleteMany({
          where: { dialogId: dialog.id },
        })

        await tx.dialog.delete({
          where: { id: dialog.id },
        })
        continue
      }

      const nextOwnerId =
        dialog.ownerId === user.id ? remainingUserIds[0] : dialog.ownerId

      await tx.dialog.update({
        where: { id: dialog.id },
        data: {
          ownerId: nextOwnerId,
          users: {
            disconnect: { id: user.id },
          },
        },
      })
    }

    await tx.message.deleteMany({
      where: { authorId: user.id },
    })

    await tx.pushSubscription.deleteMany({
      where: { userId },
    })

    await tx.user.update({
      where: { id: userId },
      data: {
        updatedAt: new Date(),
      },
    })
  })

  return true
}

function generateRecoveryCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function registerUser(input: {
  email: string
  password: string
  firstName: string
  lastName?: string
  phone: string
}): Promise<AuthResult> {
  const email = input.email.toLowerCase()
  const duplicateUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone: input.phone }],
    },
    select: {
      email: true,
      phone: true,
    },
  })

  if (duplicateUser) {
    const fieldErrors: Record<string, string[]> = {}

    if (duplicateUser.email === email) {
      fieldErrors.email = ["Пользователь с таким email уже существует"]
    }

    if (duplicateUser.phone === input.phone) {
      fieldErrors.phone = ["Пользователь с таким телефоном уже существует"]
    }

    return {
      ok: false,
      status: 409,
      message: "Пользователь уже существует",
      fieldErrors,
    }
  }

  const passwordHash = await bcrypt.hash(input.password, 12)
  const role = await resolveInitialRole(email)

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName || null,
        phone: input.phone,
        role,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
      },
    })

    return { ok: true, user }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const targets = Array.isArray(error.meta?.target) ? error.meta.target : []
      const fieldErrors: Record<string, string[]> = {}

      if (targets.includes("email")) {
        fieldErrors.email = ["Пользователь с таким email уже существует"]
      }

      if (targets.includes("phone")) {
        fieldErrors.phone = ["Пользователь с таким телефоном уже существует"]
      }

      return {
        ok: false,
        status: 409,
        message: "Пользователь уже существует",
        fieldErrors,
      }
    }

    throw error
  }
}

export async function loginUser(input: {
  email: string
  password: string
}): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      isBlocked: true,
    },
  })

  if (!user) {
    return { ok: false, status: 401, message: "Неверный email или пароль" }
  }

  if (user.isBlocked) {
    return { ok: false, status: 403, message: "Аккаунт заблокирован" }
  }

  const passwordMatch = await bcrypt.compare(input.password, user.passwordHash)

  if (!passwordMatch) {
    return { ok: false, status: 401, message: "Неверный email или пароль" }
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
    },
  }
}

export async function requestRecoveryCode(input: { phone: string }) {
  const phone = input.phone.trim()
  const user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      email: true,
      phone: true,
    },
  })

  if (!user) {
    return { ok: true as const }
  }

  const code = generateRecoveryCode()
  const expirationTime = Date.now() + 10 * 60 * 1000

  await prisma.$transaction(async (tx) => {
    await tx.otp.deleteMany({
      where: { phone },
    })

    await tx.otp.create({
      data: {
        email: user.email,
        phone,
        code: Number(code),
        expiredAt: expirationTime,
      },
    })
  })

  await sendRecoveryCodeEmail({
    to: user.email,
    code,
  })

  return { ok: true as const }
}

export async function recoverUserAccount(input: {
  phone: string
  code: string
}): Promise<AuthResult> {
  const phone = input.phone.trim()
  const otp = await prisma.otp.findFirst({
    where: {
      phone,
      code: Number(input.code),
    },
    select: {
      id: true,
      expiredAt: true,
    },
  })

  if (!otp || otp.expiredAt < Date.now()) {
    return { ok: false, status: 401, message: "Неверный или просроченный код" }
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      email: true,
    },
  })

  if (!user) {
    await prisma.otp.deleteMany({
      where: { phone },
    })
    return { ok: false, status: 404, message: "Аккаунт не найден" }
  }

  await prisma.otp.deleteMany({
    where: { phone },
  })

  const cleared = await clearUserAccountData(user.id)
  if (!cleared) {
    return { ok: false, status: 404, message: "Аккаунт не найден" }
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
    },
  }
}
