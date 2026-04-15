import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"

import { prisma } from "@/shared/lib/db/prisma"

type AuthResult =
  | { ok: true; user: { id: number; email: string } }
  | {
      ok: false
      status: number
      message: string
      fieldErrors?: Record<string, string[]>
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

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName || null,
        phone: input.phone,
        role: "user",
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
    },
  })

  if (!user) {
    return { ok: false, status: 401, message: "Неверный email или пароль" }
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
