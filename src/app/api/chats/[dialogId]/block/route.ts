import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

function parseDialogId(value: string) {
  const dialogId = Number(value)
  return Number.isInteger(dialogId) && dialogId > 0 ? dialogId : null
}

function parseTargetUserId(value: unknown) {
  const targetUserId = Number(value)
  return Number.isInteger(targetUserId) && targetUserId > 0 ? targetUserId : null
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ dialogId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { dialogId: dialogIdParam } = await context.params
  const dialogId = parseDialogId(dialogIdParam)
  if (!dialogId) {
    return NextResponse.json({ message: "Неверный id чата" }, { status: 400 })
  }

  const json = await request.json().catch(() => null)
  const targetUserId = parseTargetUserId(json?.targetUserId)
  if (!targetUserId) {
    return NextResponse.json({ message: "Неверный id пользователя" }, { status: 400 })
  }

  if (targetUserId === userId) {
    return NextResponse.json({ message: "Нельзя заблокировать самого себя" }, { status: 400 })
  }

  const dialog = await prisma.dialog.findFirst({
    where: {
      id: dialogId,
      users: {
        some: { id: userId },
      },
    },
    select: {
      id: true,
      ownerId: true,
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
        orderBy: { id: "asc" },
      },
      blockedUsers: {
        where: { userId: targetUserId },
        select: { id: true },
      },
    },
  })

  if (!dialog) {
    return NextResponse.json({ message: "Чат не найден" }, { status: 404 })
  }

  if (dialog.ownerId !== userId) {
    return NextResponse.json(
      { message: "Блокировать участников может только владелец чата" },
      { status: 403 }
    )
  }

  if (dialog.users.length <= 2) {
    return NextResponse.json(
      { message: "Блокировка доступна только в групповых чатах" },
      { status: 400 }
    )
  }

  if (dialog.blockedUsers.length > 0) {
    return NextResponse.json({ message: "Пользователь уже заблокирован" }, { status: 409 })
  }

  const targetUser = dialog.users.find((item) => item.id === targetUserId)
  if (!targetUser) {
    return NextResponse.json({ message: "Участник не найден" }, { status: 404 })
  }

  const targetUserName = `${targetUser.firstName} ${targetUser.lastName ?? ""}`.trim()

  const message = await prisma.$transaction(async (tx) => {
    const createdMessage = await tx.message.create({
      data: {
        content: `${targetUserName} был заблокирован владельцем чата`,
        dialogId,
        authorId: userId,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    await tx.dialogBlockedUser.create({
      data: {
        dialogId,
        userId: targetUserId,
        blockedById: userId,
      },
    })

    await tx.dialog.update({
      where: { id: dialogId },
      data: {
        users: {
          disconnect: { id: targetUserId },
        },
      },
    })

    return createdMessage
  })

  return NextResponse.json(
    {
      blockedUserId: targetUserId,
      message: {
        id: message.id,
        content: message.content,
        status: message.status,
        createdAt: message.createdAt,
        dialogId: message.dialogId,
        author: message.author,
      },
    },
    { status: 200 }
  )
}
