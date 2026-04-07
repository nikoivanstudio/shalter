import { type NextRequest, NextResponse } from "next/server"

import { sendMessageSchema } from "@/features/chats/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

function parsePositiveInt(value: string) {
  const result = Number(value)
  return Number.isInteger(result) && result > 0 ? result : null
}

async function canAccessDialog(dialogId: number, userId: number) {
  const dialog = await prisma.dialog.findFirst({
    where: { id: dialogId, users: { some: { id: userId } } },
    select: { id: true },
  })
  return Boolean(dialog)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ dialogId: string; messageId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { dialogId: dialogIdParam, messageId: messageIdParam } = await context.params
  const dialogId = parsePositiveInt(dialogIdParam)
  const messageId = parsePositiveInt(messageIdParam)

  if (!dialogId || !messageId) {
    return NextResponse.json({ message: "Неверные идентификаторы" }, { status: 400 })
  }

  const hasAccess = await canAccessDialog(dialogId, userId)
  if (!hasAccess) {
    return NextResponse.json({ message: "Чат не найден" }, { status: 404 })
  }

  const existing = await prisma.message.findFirst({
    where: { id: messageId, dialogId },
    select: { id: true, authorId: true },
  })

  if (!existing) {
    return NextResponse.json({ message: "Сообщение не найдено" }, { status: 404 })
  }

  if (existing.authorId !== userId) {
    return NextResponse.json({ message: "Можно редактировать только свои сообщения" }, { status: 403 })
  }

  const json = await request.json().catch(() => null)
  const parsed = sendMessageSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Ошибка валидации",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: {
      content: parsed.data.content,
      updatedAt: new Date(),
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

  return NextResponse.json(
    {
      message: {
        id: updated.id,
        content: updated.content,
        status: updated.status,
        createdAt: updated.createdAt,
        dialogId: updated.dialogId,
        author: updated.author,
      },
    },
    { status: 200 }
  )
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ dialogId: string; messageId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { dialogId: dialogIdParam, messageId: messageIdParam } = await context.params
  const dialogId = parsePositiveInt(dialogIdParam)
  const messageId = parsePositiveInt(messageIdParam)

  if (!dialogId || !messageId) {
    return NextResponse.json({ message: "Неверные идентификаторы" }, { status: 400 })
  }

  const hasAccess = await canAccessDialog(dialogId, userId)
  if (!hasAccess) {
    return NextResponse.json({ message: "Чат не найден" }, { status: 404 })
  }

  const existing = await prisma.message.findFirst({
    where: { id: messageId, dialogId },
    select: { id: true, authorId: true },
  })

  if (!existing) {
    return NextResponse.json({ message: "Сообщение не найдено" }, { status: 404 })
  }

  if (existing.authorId !== userId) {
    return NextResponse.json({ message: "Можно удалять только свои сообщения" }, { status: 403 })
  }

  await prisma.message.delete({ where: { id: messageId } })
  return NextResponse.json({ ok: true }, { status: 200 })
}
