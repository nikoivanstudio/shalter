import { Prisma } from "@prisma/client"
import { type NextRequest, NextResponse } from "next/server"

import { addContactSchema } from "@/features/contacts/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthorizedUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
    }

    const json = await request.json()
    const parsed = addContactSchema.safeParse(json)

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

    const { contactUserId } = parsed.data

    if (contactUserId === userId) {
      return NextResponse.json(
        { message: "Нельзя добавить самого себя в контакты" },
        { status: 400 }
      )
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: contactUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ message: "Пользователь не найден" }, { status: 404 })
    }

    const blacklistEntry = await prisma.userBlacklist.findFirst({
      where: {
        ownerId: userId,
        blockedUserId: contactUserId,
      },
      select: { id: true },
    })

    if (blacklistEntry) {
      return NextResponse.json(
        { message: "Пользователь находится в чёрном списке" },
        { status: 400 }
      )
    }

    await prisma.contact.create({
      data: {
        ownerId: userId,
        contactUserId,
      },
    })

    return NextResponse.json({ contact: targetUser }, { status: 201 })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ message: "Этот контакт уже добавлен" }, { status: 409 })
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
    const parsed = addContactSchema.safeParse(json)

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

    const { contactUserId } = parsed.data

    const deleted = await prisma.contact.deleteMany({
      where: {
        ownerId: userId,
        contactUserId,
      },
    })

    if (deleted.count === 0) {
      return NextResponse.json({ message: "Контакт не найден" }, { status: 404 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch {
    return NextResponse.json({ message: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
