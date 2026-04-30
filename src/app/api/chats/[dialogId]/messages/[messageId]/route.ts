import { type NextRequest, NextResponse } from "next/server"

import { sendMessageSchema } from "@/features/chats/model/schemas"
import { formatBlacklistUserName } from "@/shared/lib/blacklist"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"
import { canWriteToDialog } from "@/shared/lib/direct-message-access"
import { getDialogMessageMedia } from "@/shared/lib/media/message-store"
import { deleteUploadedFileByUrl } from "@/shared/lib/media/uploads"

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
    return NextResponse.json({ message: "РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ" }, { status: 401 })
  }

  const { dialogId: dialogIdParam, messageId: messageIdParam } = await context.params
  const dialogId = parsePositiveInt(dialogIdParam)
  const messageId = parsePositiveInt(messageIdParam)

  if (!dialogId || !messageId) {
    return NextResponse.json({ message: "РќРµРІРµСЂРЅС‹Рµ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂС‹" }, { status: 400 })
  }

  const hasAccess = await canAccessDialog(dialogId, userId)
  if (!hasAccess) {
    return NextResponse.json({ message: "Р§Р°С‚ РЅРµ РЅР°Р№РґРµРЅ" }, { status: 404 })
  }

  const existing = await prisma.message.findFirst({
    where: { id: messageId, dialogId },
    select: { id: true, authorId: true },
  })

  if (!existing) {
    return NextResponse.json({ message: "РЎРѕРѕР±С‰РµРЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ" }, { status: 404 })
  }

  if (existing.authorId !== userId) {
    return NextResponse.json({ message: "РњРѕР¶РЅРѕ СЂРµРґР°РєС‚РёСЂРѕРІР°С‚СЊ С‚РѕР»СЊРєРѕ СЃРІРѕРё СЃРѕРѕР±С‰РµРЅРёСЏ" }, { status: 403 })
  }

  const media = await getDialogMessageMedia(messageId, dialogId)
  if (media?.media_kind) {
    return NextResponse.json(
      { message: "Медиа-сообщения пока можно только удалить и отправить заново" },
      { status: 400 }
    )
  }

  const writeAccess = await canWriteToDialog(dialogId, userId)
  if (!writeAccess.ok && writeAccess.code === "CONTACT_REQUIRED") {
    return NextResponse.json(
      {
        message: "Р­С‚РѕРјСѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ РјРѕРіСѓС‚ РїРёСЃР°С‚СЊ С‚РѕР»СЊРєРѕ Р»СЋРґРё РёР· РµРіРѕ РєРѕРЅС‚Р°РєС‚РѕРІ",
      },
      { status: 403 }
    )
  }

  const json = await request.json().catch(() => null)
  const parsed = sendMessageSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "РћС€РёР±РєР° РІР°Р»РёРґР°С†РёРё",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const blockedByUsers = await prisma.userBlacklist.findMany({
    where: {
      blockedUserId: userId,
      owner: {
        dialogs: {
          some: {
            id: dialogId,
          },
        },
      },
    },
    select: {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  if (blockedByUsers.length > 0) {
    const names = blockedByUsers.map((item) => formatBlacklistUserName(item.owner)).join(", ")
    return NextResponse.json(
      {
        message: `Р’С‹ РЅРµ РјРѕР¶РµС‚Рµ РїРёСЃР°С‚СЊ РІ СЌС‚РѕС‚ С‡Р°С‚. Р’Р°СЃ РґРѕР±Р°РІРёР»Рё РІ С‡С‘СЂРЅС‹Р№ СЃРїРёСЃРѕРє: ${names}`,
      },
      { status: 403 }
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
    return NextResponse.json({ message: "РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ" }, { status: 401 })
  }

  const { dialogId: dialogIdParam, messageId: messageIdParam } = await context.params
  const dialogId = parsePositiveInt(dialogIdParam)
  const messageId = parsePositiveInt(messageIdParam)

  if (!dialogId || !messageId) {
    return NextResponse.json({ message: "РќРµРІРµСЂРЅС‹Рµ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂС‹" }, { status: 400 })
  }

  const hasAccess = await canAccessDialog(dialogId, userId)
  if (!hasAccess) {
    return NextResponse.json({ message: "Р§Р°С‚ РЅРµ РЅР°Р№РґРµРЅ" }, { status: 404 })
  }

  const existing = await prisma.message.findFirst({
    where: { id: messageId, dialogId },
    select: { id: true, authorId: true },
  })

  if (!existing) {
    return NextResponse.json({ message: "РЎРѕРѕР±С‰РµРЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ" }, { status: 404 })
  }

  if (existing.authorId !== userId) {
    return NextResponse.json({ message: "РњРѕР¶РЅРѕ СѓРґР°Р»СЏС‚СЊ С‚РѕР»СЊРєРѕ СЃРІРѕРё СЃРѕРѕР±С‰РµРЅРёСЏ" }, { status: 403 })
  }

  const media = await getDialogMessageMedia(messageId, dialogId)
  await prisma.message.delete({ where: { id: messageId } })
  await deleteUploadedFileByUrl(media?.media_url ?? null)
  return NextResponse.json({ ok: true }, { status: 200 })
}
