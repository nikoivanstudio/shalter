import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"
import { parseMessageInput } from "@/shared/lib/media/message-input"
import { createChannelMessage, getChannelMessages } from "@/shared/lib/media/message-store"
import { saveMessageFile, validateMessageFile } from "@/shared/lib/media/uploads"

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

  const messages = await getChannelMessages(channelId)

  return NextResponse.json(
    {
      messages,
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

  const parsed = await parseMessageInput(request)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "РћС€РёР±РєР° РІР°Р»РёРґР°С†РёРё",
        fieldErrors: parsed.fieldErrors,
      },
      { status: 400 }
    )
  }

  const attachments = []
  for (const item of parsed.data.attachments) {
    const validationError = validateMessageFile(item.kind, item.file)
    if (validationError) {
      return NextResponse.json(
        {
          message: "РћС€РёР±РєР° РІР°Р»РёРґР°С†РёРё",
          fieldErrors: {
            attachment: [validationError],
          },
        },
        { status: 400 }
      )
    }

    attachments.push({
      kind: item.kind,
      ...(await saveMessageFile(item.kind, item.file)),
    })
  }

  const message = await createChannelMessage({
    channelId,
    authorId: userId,
    content: parsed.data.content,
    attachments,
  })

  return NextResponse.json(
    {
      message,
    },
    { status: 201 }
  )
}
