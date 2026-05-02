import { type NextRequest, NextResponse } from "next/server"

import { updateProfileSchema } from "@/features/profile/model/schemas"
import {
  AUTH_SESSION_COOKIE,
  AUTH_TOKEN_COOKIE,
  clearAuthCookies,
  createAuthToken,
  setAuthCookies,
  verifyAuthToken,
} from "@/shared/lib/auth/session"
import { prisma } from "@/shared/lib/db/prisma"
import { isPrismaKnownRequestError } from "@/shared/lib/db/prisma-errors"
import { deleteUploadedFileByUrl, saveAvatarFile, validateAvatarFile } from "@/shared/lib/media/uploads"
import { touchUserActivity } from "@/shared/lib/user-activity"

async function getCurrentAvatarUrl(userId: number) {
  const rows = await prisma.$queryRawUnsafe<Array<{ avatar_url: string | null }>>(
    `
      select avatar_url
      from users
      where id = $1
      limit 1
    `,
    userId
  )

  return rows[0]?.avatar_url ?? null
}

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

    const contentType = request.headers.get("content-type") ?? ""
    let avatarFile: File | null = null
    let parsedPayload: unknown = null

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const profileValue = formData.get("profile")
      parsedPayload = typeof profileValue === "string" ? JSON.parse(profileValue) : null
      const avatarValue = formData.get("avatarFile")
      avatarFile = avatarValue instanceof File && avatarValue.size > 0 ? avatarValue : null
    } else {
      parsedPayload = await request.json()
    }

    const parsed = updateProfileSchema.safeParse(parsedPayload)

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

    let savedAvatarUrl: string | null | undefined
    if (avatarFile) {
      const avatarError = validateAvatarFile(avatarFile)
      if (avatarError) {
        return NextResponse.json(
          {
            message: "Ошибка валидации",
            fieldErrors: {
              avatarFile: [avatarError],
            },
          },
          { status: 400 }
        )
      }

      savedAvatarUrl = (await saveAvatarFile(avatarFile)).url
    }

    const data = parsed.data
    const previousAvatarUrl = await getCurrentAvatarUrl(payload.userId)
    const updated = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName || null,
        phone: data.phone,
        avatarTone: data.avatarTone,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarTone: true,
      },
    })

    const avatarUrl = typeof savedAvatarUrl === "undefined" ? previousAvatarUrl : savedAvatarUrl

    if (typeof savedAvatarUrl !== "undefined") {
      await prisma.$executeRawUnsafe(
        `
          update users
          set avatar_url = $1
          where id = $2
        `,
        savedAvatarUrl,
        payload.userId
      )
      await deleteUploadedFileByUrl(previousAvatarUrl)
    }

    const nextToken = await createAuthToken({
      userId: updated.id,
      email: updated.email,
      sid: sessionId,
    })

    const response = NextResponse.json(
      {
        user: {
          ...updated,
          avatarUrl,
        },
      },
      { status: 200 }
    )
    setAuthCookies(response, { token: nextToken, sessionId })
    return response
  } catch (error) {
    if (isPrismaKnownRequestError(error, "P2002")) {
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

export async function DELETE(request: NextRequest) {
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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
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
      const response = NextResponse.json({ ok: true }, { status: 200 })
      clearAuthCookies(response)
      return response
    }

    await prisma.$transaction(async (tx) => {
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

      await tx.user.delete({
        where: { id: user.id },
      })
    })

    const response = NextResponse.json({ ok: true }, { status: 200 })
    clearAuthCookies(response)
    return response
  } catch {
    return NextResponse.json({ message: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
