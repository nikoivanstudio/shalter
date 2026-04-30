import { type NextRequest, NextResponse } from "next/server"

import { formatBlacklistUserName } from "@/shared/lib/blacklist"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"
import { canWriteToDialog } from "@/shared/lib/direct-message-access"
import { parseMessageInput } from "@/shared/lib/media/message-input"
import { createDialogMessage, getDialogMessages } from "@/shared/lib/media/message-store"
import { saveMessageFile, validateMessageFile } from "@/shared/lib/media/uploads"
import { sendPushToDialogRecipients } from "@/shared/lib/notifications/push"

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

async function getMissingDialogReason(dialogId: number) {
  const existingDialog = await prisma.dialog.findUnique({
    where: { id: dialogId },
    select: { id: true },
  })

  return existingDialog ? "REMOVED_FROM_CHAT" : "CHAT_DELETED"
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ dialogId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ" }, { status: 401 })
  }

  const { dialogId: dialogIdParam } = await context.params
  const dialogId = parseDialogId(dialogIdParam)
  if (!dialogId) {
    return NextResponse.json({ message: "РќРµРІРµСЂРЅС‹Р№ id С‡Р°С‚Р°" }, { status: 400 })
  }

  const hasAccess = await checkDialogAccess(dialogId, userId)
  if (!hasAccess) {
    const reason = await getMissingDialogReason(dialogId)
    return NextResponse.json(
      {
        code: reason,
        message: reason === "REMOVED_FROM_CHAT" ? "Р’Р°СЃ СѓРґР°Р»РёР»Рё РёР· С‡Р°С‚Р°" : "Р§Р°С‚ РЅРµ РЅР°Р№РґРµРЅ",
      },
      { status: 404 }
    )
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

  const messages = await getDialogMessages(dialogId)

  return NextResponse.json(
    {
      messages,
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
    return NextResponse.json({ message: "РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ" }, { status: 401 })
  }

  const { dialogId: dialogIdParam } = await context.params
  const dialogId = parseDialogId(dialogIdParam)
  if (!dialogId) {
    return NextResponse.json({ message: "РќРµРІРµСЂРЅС‹Р№ id С‡Р°С‚Р°" }, { status: 400 })
  }

  const hasAccess = await checkDialogAccess(dialogId, userId)
  if (!hasAccess) {
    const reason = await getMissingDialogReason(dialogId)
    return NextResponse.json(
      {
        code: reason,
        message: reason === "REMOVED_FROM_CHAT" ? "Р’Р°СЃ СѓРґР°Р»РёР»Рё РёР· С‡Р°С‚Р°" : "Р§Р°С‚ РЅРµ РЅР°Р№РґРµРЅ",
      },
      { status: 404 }
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

  const parsed = await parseMessageInput(request)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Ошибка валидации",
        fieldErrors: parsed.fieldErrors,
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

  let attachment = null
  if (parsed.data.attachment) {
    const validationError = validateMessageFile(parsed.data.attachment.kind, parsed.data.attachment.file)
    if (validationError) {
      return NextResponse.json(
        {
          message: "Ошибка валидации",
          fieldErrors: {
            attachment: [validationError],
          },
        },
        { status: 400 }
      )
    }

    attachment = await saveMessageFile(parsed.data.attachment.kind, parsed.data.attachment.file)
  }

  const message = await createDialogMessage({
    content: parsed.data.content,
    status: MESSAGE_STATUS.SENT,
    dialogId,
    authorId: userId,
    attachment:
      attachment && parsed.data.attachment
        ? {
            kind: parsed.data.attachment.kind,
            ...attachment,
          }
        : null,
  })

  void sendPushToDialogRecipients({
    dialogId,
    authorId: userId,
    authorName: `${message.author.firstName} ${message.author.lastName ?? ""}`.trim(),
    content: message.content,
  })

  return NextResponse.json(
    {
      message,
    },
    { status: 201 }
  )
}
