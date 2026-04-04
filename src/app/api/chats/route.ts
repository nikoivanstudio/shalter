import { type NextRequest, NextResponse } from "next/server"

import { createChatSchema } from "@/features/chats/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

export async function POST(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const json = await request.json().catch(() => null)
  const parsed = createChatSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Ошибка валидации",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const participantIds = Array.from(
    new Set(parsed.data.participantIds.filter((id) => id !== userId))
  )

  if (participantIds.length === 0) {
    return NextResponse.json(
      { message: "Нужно выбрать хотя бы одного пользователя из контактов" },
      { status: 400 }
    )
  }

  const allowedContacts = await prisma.contact.findMany({
    where: {
      ownerId: userId,
      contactUserId: { in: participantIds },
    },
    select: { contactUserId: true },
  })

  if (allowedContacts.length !== participantIds.length) {
    return NextResponse.json(
      { message: "Можно добавлять в чат только пользователей из контактов" },
      { status: 400 }
    )
  }

  const dialog = await prisma.dialog.create({
    data: {
      ownerId: userId,
      users: {
        connect: [{ id: userId }, ...participantIds.map((id) => ({ id }))],
      },
    },
    include: {
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  })

  return NextResponse.json(
    {
      dialog: {
        id: dialog.id,
        ownerId: dialog.ownerId,
        users: dialog.users,
        lastMessage: null,
      },
    },
    { status: 201 }
  )
}
