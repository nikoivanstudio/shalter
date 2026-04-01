import { Prisma } from "@prisma/client"
import { type NextRequest, NextResponse } from "next/server"

import { updateProfileSchema } from "@/features/profile/model/schemas"
import { prisma } from "@/shared/lib/db/prisma"
import {
  AUTH_SESSION_COOKIE,
  AUTH_TOKEN_COOKIE,
  createAuthToken,
  setAuthCookies,
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

    const json = await request.json()
    const parsed = updateProfileSchema.safeParse(json)

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      return NextResponse.json(
        {
          message: "Ошибка валидации",
          fieldErrors,
        },
        { status: 400 }
      )
    }

    const data = parsed.data
    const updated = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName || null,
        phone: data.phone,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    })

    const nextToken = await createAuthToken({
      userId: updated.id,
      email: updated.email,
      sid: sessionId,
    })

    const response = NextResponse.json({ user: updated }, { status: 200 })
    setAuthCookies(response, { token: nextToken, sessionId })
    return response
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          message: "Пользователь с таким email уже существует",
          fieldErrors: {
            email: ["Пользователь с таким email уже существует"],
          },
        },
        { status: 409 }
      )
    }

    return NextResponse.json({ message: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
