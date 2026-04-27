import { Prisma } from "@prisma/client"
import { type NextRequest, NextResponse } from "next/server"

import { blacklistUserSchema } from "@/features/contacts/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthorizedUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
    }

    const json = await request.json().catch(() => null)
    const parsed = blacklistUserSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Ошибка валидации",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { blockedUserId } = parsed.data
    if (blockedUserId === userId) {
      return NextResponse.json(
        { message: "Нельзя добавить самого себя в чёрный список" },
        { status: 400 }
      )
    }

    const blockedUser = await prisma.user.findUnique({
      where: { id: blockedUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        role: true,
        isBlocked: true,
      },
    })

    if (!blockedUser) {
      return NextResponse.json({ message: "Пользователь не найден" }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.userBlacklist.create({
        data: {
          ownerId: userId,
          blockedUserId,
        },
      })

      await tx.contact.deleteMany({
        where: {
          ownerId: userId,
          contactUserId: blockedUserId,
        },
      })
    })

    return NextResponse.json({ blockedUser }, { status: 201 })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Этот пользователь уже в чёрном списке" },
        { status: 409 }
      )
    }

    return NextResponse.json({ message: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthorizedUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
    }

    const json = await request.json().catch(() => null)
    const parsed = blacklistUserSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Ошибка валидации",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const deleted = await prisma.userBlacklist.deleteMany({
      where: {
        ownerId: userId,
        blockedUserId: parsed.data.blockedUserId,
      },
    })

    if (deleted.count === 0) {
      return NextResponse.json({ message: "Пользователь не найден в чёрном списке" }, { status: 404 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch {
    return NextResponse.json({ message: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
