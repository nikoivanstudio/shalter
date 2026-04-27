import bcrypt from "bcryptjs"
import { type NextRequest, NextResponse } from "next/server"

import { changePasswordSchema } from "@/features/profile/model/schemas"
import { prisma } from "@/shared/lib/db/prisma"
import { touchUserActivity } from "@/shared/lib/user-activity"
import {
  AUTH_SESSION_COOKIE,
  AUTH_TOKEN_COOKIE,
  verifyAuthToken,
} from "@/shared/lib/auth/session"

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value
    const sessionId = request.cookies.get(AUTH_SESSION_COOKIE)?.value

    if (!token || !sessionId) {
      return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
    }

    const payload = await verifyAuthToken(token)
    if (!payload || payload.sid !== sessionId) {
      return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
    }

    await touchUserActivity(payload.userId)

    const json = await request.json()
    const parsed = changePasswordSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Ошибка валидации",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        passwordHash: true,
      },
    })

    if (!user) {
      return NextResponse.json({ message: "Пользователь не найден" }, { status: 404 })
    }

    const passwordMatches = await bcrypt.compare(
      parsed.data.currentPassword,
      user.passwordHash
    )

    if (!passwordMatches) {
      return NextResponse.json(
        {
          message: "Текущий пароль введён неверно",
          fieldErrors: {
            currentPassword: ["Текущий пароль введён неверно"],
          },
        },
        { status: 400 }
      )
    }

    const nextPasswordHash = await bcrypt.hash(parsed.data.newPassword, 12)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: nextPasswordHash,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/profile/password failed", error)
    return NextResponse.json({ message: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
