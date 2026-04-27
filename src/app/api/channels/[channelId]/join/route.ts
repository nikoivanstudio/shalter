import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

function parseChannelId(value: string) {
  const channelId = Number(value)
  return Number.isInteger(channelId) && channelId > 0 ? channelId : null
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

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true },
  })

  if (!channel) {
    return NextResponse.json({ message: "Канал не найден" }, { status: 404 })
  }

  await prisma.channelParticipant.upsert({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
    update: {},
    create: {
      channelId,
      userId,
      role: "MEMBER",
    },
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
