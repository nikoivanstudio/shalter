import bcrypt from "bcryptjs"

import { env } from "@/shared/config/env"
import { prisma } from "@/shared/lib/db/prisma"

type AuthResult =
  | { ok: true; user: { id: number; email: string } }
  | { ok: false; status: number; message: string }

export async function registerUser(input: {
  email: string
  password: string
  firstName: string
  lastName?: string
  phone: string
  inviteMessage: string
}): Promise<AuthResult> {
  if (input.inviteMessage !== env.INVITE_MESSAGE) {
    return { ok: false, status: 403, message: "Неверная строка приглашения" }
  }

  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: { id: true },
  })

  if (existing) {
    return { ok: false, status: 409, message: "Пользователь уже существует" }
  }

  const passwordHash = await bcrypt.hash(input.password, 12)

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
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
