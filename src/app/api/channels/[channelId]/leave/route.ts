import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

function parsePositiveInt(value: string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
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
  const channelId = parsePositiveInt(rawChannelId)
  if (!channelId) {
    return NextResponse.json({ message: "Неверный id канала" }, { status: 400 })
  }

  const participant = await prisma.channelParticipant.findFirst({
    where: {
      channelId,
      userId,
    },
    include: {
      channel: {
        select: {
          ownerId: true,
        },
      },
    },
  })

  if (!participant) {
    return NextResponse.json({ message: "Канал не найден" }, { status: 404 })
  }

  if (participant.channel.ownerId === userId) {
    return NextResponse.json(
      { message: "Владелец не может покинуть канал, пока не удалит его" },
      { status: 400 }
    )
  }

  await prisma.channelParticipant.delete({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
