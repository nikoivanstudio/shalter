import { type NextRequest, NextResponse } from "next/server"

import { sendChannelMessageSchema } from "@/features/channels/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

function parseChannelId(value: string) {
  const channelId = Number(value)
  return Number.isInteger(channelId) && channelId > 0 ? channelId : null
}

async function getMembership(channelId: number, userId: number) {
  return prisma.channelParticipant.findFirst({
    where: {
      channelId,
      userId,
    },
    select: {
      role: true,
    },
  })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ channelId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { channelId: rawChannelId } = await context.params
  const channelId = parseChannelId(rawChannelId)
  if (!channelId) {
    return NextResponse.json({ message: "Неверный id канала" }, { status: 400 })
  }

  const membership = await getMembership(channelId, userId)
  if (!membership) {
    return NextResponse.json({ message: "Канал не найден" }, { status: 404 })
  }

  const messages = await prisma.channelMessage.findMany({
    where: { channelId },
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
        channelId: message.channelId,
        createdAt: message.createdAt.toISOString(),
        author: message.author,
      })),
    },
    { status: 200 }
  )
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ channelId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { channelId: rawChannelId } = await context.params
  const channelId = parseChannelId(rawChannelId)
  if (!channelId) {
    return NextResponse.json({ message: "Неверный id канала" }, { status: 400 })
  }

  const membership = await getMembership(channelId, userId)
  if (!membership) {
    return NextResponse.json({ message: "Канал не найден" }, { status: 404 })
  }

  if (membership.role === "MEMBER") {
    return NextResponse.json(
      { message: "Писать в канал могут только владелец и админы" },
      { status: 403 }
    )
  }

  const json = await request.json().catch(() => null)
  const parsed = sendChannelMessageSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Ошибка валидации",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const message = await prisma.channelMessage.create({
    data: {
      channelId,
      authorId: userId,
      content: parsed.data.content,
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
        channelId: message.channelId,
        createdAt: message.createdAt.toISOString(),
        author: message.author,
      },
    },
    { status: 201 }
  )
}
