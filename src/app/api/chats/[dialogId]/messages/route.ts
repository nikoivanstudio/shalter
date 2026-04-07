import { type NextRequest, NextResponse } from "next/server"

import { sendMessageSchema } from "@/features/chats/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

const MESSAGE_STATUS = {
  SENT: "SENT",
  DELIVERED: "DELIVERED",
} as const

function parseDialogId(value: string) {
  const dialogId = Number(value)
  return Number.isInteger(dialogId) && dialogId > 0 ? dialogId : null
}

async function checkDialogAccess(dialogId: number, userId: number) {
  const dialog = await prisma.dialog.findFirst({
    where: { id: dialogId, users: { some: { id: userId } } },
    select: { id: true },
  })

  return Boolean(dialog)
}

export async function GET(
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

  const hasAccess = await checkDialogAccess(dialogId, userId)
  if (!hasAccess) {
    return NextResponse.json({ message: "Чат не найден" }, { status: 404 })
  }

  await prisma.message.updateMany({
    where: {
      dialogId,
      authorId: { not: userId },
      status: MESSAGE_STATUS.SENT,
    },
    data: {
      status: MESSAGE_STATUS.DELIVERED,
      updatedAt: new Date(),
    },
  })

  const messages = await prisma.message.findMany({
    where: { dialogId },
    orderBy: { id: "asc" },
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
      messages: messages.map((message) => ({
        id: message.id,
        content: message.content,
        status: message.status,
        createdAt: message.createdAt,
        dialogId: message.dialogId,
        author: message.author,
      })),
    },
    { status: 200 }
  )
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

  const hasAccess = await checkDialogAccess(dialogId, userId)
  if (!hasAccess) {
    return NextResponse.json({ message: "Чат не найден" }, { status: 404 })
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

  const message = await prisma.message.create({
    data: {
      content: parsed.data.content,
      status: MESSAGE_STATUS.SENT,
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

  return NextResponse.json(
    {
      message: {
        id: message.id,
        content: message.content,
        status: message.status,
        createdAt: message.createdAt,
        dialogId: message.dialogId,
        author: message.author,
      },
    },
    { status: 201 }
  )
}
