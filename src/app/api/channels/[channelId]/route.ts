import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

function parseChannelId(value: string) {
  const channelId = Number(value)
  return Number.isInteger(channelId) && channelId > 0 ? channelId : null
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ channelId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ" }, { status: 401 })
  }

  const { channelId: rawChannelId } = await context.params
  const channelId = parseChannelId(rawChannelId)
  if (!channelId) {
    return NextResponse.json({ message: "РќРµРІРµСЂРЅС‹Р№ id РєР°РЅР°Р»Р°" }, { status: 400 })
  }

  const channel = await prisma.channel.findFirst({
    where: {
      id: channelId,
      participants: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
      ownerId: true,
    },
  })

  if (!channel) {
    return NextResponse.json({ message: "РљР°РЅР°Р» РЅРµ РЅР°Р№РґРµРЅ" }, { status: 404 })
  }

  if (channel.ownerId !== userId) {
    return NextResponse.json(
      { message: "РЈРґР°Р»СЏС‚СЊ РєР°РЅР°Р» РјРѕР¶РµС‚ С‚РѕР»СЊРєРѕ РІР»Р°РґРµР»РµС†" },
      { status: 403 }
    )
  }

  await prisma.channel.delete({
    where: {
      id: channelId,
    },
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
