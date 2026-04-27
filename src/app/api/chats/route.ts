import { type NextRequest, NextResponse } from "next/server"

import { createChatSchema } from "@/features/chats/model/schemas"
import { findUsersWhoBlockedActor, formatBlacklistUserName } from "@/shared/lib/blacklist"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"
import { canWriteToProtectedUser } from "@/shared/lib/direct-message-access"
import { isUserOnline } from "@/shared/lib/user-activity"

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
  const title = parsed.data.title?.trim() || null

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

  const blockedByUsers = await findUsersWhoBlockedActor(userId, participantIds)
  if (blockedByUsers.length > 0) {
    const names = blockedByUsers.map((item) => formatBlacklistUserName(item.owner)).join(", ")
    return NextResponse.json(
      {
        message: `Нельзя добавить в чат: ${names}. Этот пользователь добавил вас в чёрный список`,
      },
      { status: 403 }
    )
  }

  const isPrivateChat = participantIds.length === 1
  if (isPrivateChat) {
    const otherUserId = participantIds[0]
    const writeAccess = await canWriteToProtectedUser(userId, otherUserId)
    if (!writeAccess.ok && writeAccess.code === "CONTACT_REQUIRED") {
      return NextResponse.json(
        {
          message: "Этому пользователю могут писать только люди из его контактов",
        },
        { status: 403 }
      )
    }

    const existingDialog = await prisma.dialog.findFirst({
      where: {
        users: {
          some: { id: userId },
        },
        AND: [
          { users: { some: { id: otherUserId } } },
          {
            users: {
              every: {
                id: { in: [userId, otherUserId] },
              },
            },
          },
        ],
      },
      select: { id: true },
    })

    if (existingDialog) {
      return NextResponse.json(
        {
          existing: true,
          dialogId: existingDialog.id,
        },
        { status: 200 }
      )
    }
  }

  const isGroupChat = participantIds.length >= 2
  if (isGroupChat && !title) {
    return NextResponse.json(
      { message: "Для группового чата укажите название" },
      { status: 400 }
    )
  }

  const dialog = await prisma.$transaction(async (tx) => {
    return tx.dialog.create({
      data: {
        ownerId: userId,
        title,
        users: {
          connect: [{ id: userId }, ...participantIds.map((id) => ({ id }))],
        },
      },
      select: {
        id: true,
        ownerId: true,
        title: true,
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            lastSeenAt: true,
          },
        },
      },
    })
  })

  return NextResponse.json(
    {
      dialog: {
        id: dialog.id,
        ownerId: dialog.ownerId,
        title: dialog.title,
        users: dialog.users.map((dialogUser) => ({
          ...dialogUser,
          lastSeenAt: dialogUser.lastSeenAt ? dialogUser.lastSeenAt.toISOString() : null,
          isOnline: isUserOnline(dialogUser.lastSeenAt),
        })),
        lastMessage: null,
      },
    },
    { status: 201 }
  )
}
