import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

const MESSAGE_STATUS = {
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  READ: "READ",
} as const

function parseDialogId(value: string) {
  const dialogId = Number(value)
  return Number.isInteger(dialogId) && dialogId > 0 ? dialogId : null
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

  const hasAccess = await prisma.dialog.findFirst({
    where: { id: dialogId, users: { some: { id: userId } } },
    select: { id: true },
  })
  if (!hasAccess) {
    return NextResponse.json({ message: "Чат не найден" }, { status: 404 })
  }

  const toRead = await prisma.message.findMany({
    where: {
      dialogId,
      authorId: { not: userId },
      status: { in: [MESSAGE_STATUS.SENT, MESSAGE_STATUS.DELIVERED] },
    },
    select: { id: true },
  })

  if (toRead.length > 0) {
    await prisma.message.updateMany({
      where: {
        id: { in: toRead.map((item) => item.id) },
      },
      data: {
        status: MESSAGE_STATUS.READ,
        updatedAt: new Date(),
      },
    })
  }

  return NextResponse.json(
    {
      readMessageIds: toRead.map((item) => item.id),
    },
    { status: 200 }
  )
}
