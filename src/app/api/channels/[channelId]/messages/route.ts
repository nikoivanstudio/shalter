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
    return NextResponse.json({ message: "РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ" }, { status: 401 })
  }

  const { channelId: rawChannelId } = await context.params
  const channelId = parseChannelId(rawChannelId)
  if (!channelId) {
    return NextResponse.json({ message: "РќРµРІРµСЂРЅС‹Р№ id РєР°РЅР°Р»Р°" }, { status: 400 })
  }

  const membership = await getMembership(channelId, userId)
  if (!membership) {
    return NextResponse.json({ message: "РљР°РЅР°Р» РЅРµ РЅР°Р№РґРµРЅ" }, { status: 404 })
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
    return NextResponse.json({ message: "РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ" }, { status: 401 })
  }

  const { channelId: rawChannelId } = await context.params
  const channelId = parseChannelId(rawChannelId)
  if (!channelId) {
    return NextResponse.json({ message: "РќРµРІРµСЂРЅС‹Р№ id РєР°РЅР°Р»Р°" }, { status: 400 })
  }

  const membership = await getMembership(channelId, userId)
  if (!membership) {
    return NextResponse.json({ message: "РљР°РЅР°Р» РЅРµ РЅР°Р№РґРµРЅ" }, { status: 404 })
  }

  if (membership.role === "MEMBER") {
    return NextResponse.json(
      { message: "РџРёСЃР°С‚СЊ РІ РєР°РЅР°Р» РјРѕРіСѓС‚ С‚РѕР»СЊРєРѕ РІР»Р°РґРµР»РµС† Рё Р°РґРјРёРЅС‹" },
      { status: 403 }
    )
  }

  const json = await request.json().catch(() => null)
  const parsed = sendChannelMessageSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "РћС€РёР±РєР° РІР°Р»РёРґР°С†РёРё",
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
