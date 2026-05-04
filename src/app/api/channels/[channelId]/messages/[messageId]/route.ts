import { type NextRequest, NextResponse } from "next/server"

import { sendChannelMessageSchema } from "@/features/channels/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"
import { deleteUploadedFileByUrl } from "@/shared/lib/media/uploads"

function parsePositiveInt(value: string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
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

async function getMessage(channelId: number, messageId: number) {
  return prisma.channelMessage.findFirst({
    where: {
      id: messageId,
      channelId,
    },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarTone: true,
          avatarUrl: true,
        },
      },
    },
  })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ channelId: string; messageId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { channelId: rawChannelId, messageId: rawMessageId } = await context.params
  const channelId = parsePositiveInt(rawChannelId)
  const messageId = parsePositiveInt(rawMessageId)
  if (!channelId || !messageId) {
    return NextResponse.json({ message: "Неверные идентификаторы" }, { status: 400 })
  }

  const membership = await getMembership(channelId, userId)
  if (!membership) {
    return NextResponse.json({ message: "Канал не найден" }, { status: 404 })
  }

  if (membership.role === "MEMBER") {
    return NextResponse.json(
      { message: "Редактировать сообщения могут только владелец и админы" },
      { status: 403 }
    )
  }

  const existing = await getMessage(channelId, messageId)
  if (!existing) {
    return NextResponse.json({ message: "Сообщение не найдено" }, { status: 404 })
  }

  if (existing.authorId !== userId) {
    return NextResponse.json(
      { message: "Можно редактировать только свои сообщения" },
      { status: 403 }
    )
  }

  if (existing.mediaKind) {
    return NextResponse.json(
      { message: "Медиа-сообщения пока можно только удалить и отправить заново" },
      { status: 400 }
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

  const updated = await prisma.channelMessage.update({
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
          avatarTone: true,
          avatarUrl: true,
        },
      },
    },
  })

  return NextResponse.json(
    {
      message: {
        id: updated.id,
        content: updated.content,
        createdAt: updated.createdAt.toISOString(),
        channelId: updated.channelId,
        author: updated.author,
        attachment:
          updated.mediaKind &&
          updated.mediaUrl &&
          updated.mediaName &&
          updated.mediaMime &&
          updated.mediaSize !== null
            ? {
                kind: updated.mediaKind,
                url: updated.mediaUrl,
                name: updated.mediaName,
                mime: updated.mediaMime,
                size: updated.mediaSize,
              }
            : null,
      },
    },
    { status: 200 }
  )
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ channelId: string; messageId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { channelId: rawChannelId, messageId: rawMessageId } = await context.params
  const channelId = parsePositiveInt(rawChannelId)
  const messageId = parsePositiveInt(rawMessageId)
  if (!channelId || !messageId) {
    return NextResponse.json({ message: "Неверные идентификаторы" }, { status: 400 })
  }

  const membership = await getMembership(channelId, userId)
  if (!membership) {
    return NextResponse.json({ message: "Канал не найден" }, { status: 404 })
  }

  if (membership.role === "MEMBER") {
    return NextResponse.json(
      { message: "Удалять сообщения могут только владелец и админы" },
      { status: 403 }
    )
  }

  const existing = await getMessage(channelId, messageId)
  if (!existing) {
    return NextResponse.json({ message: "Сообщение не найдено" }, { status: 404 })
  }

  if (existing.authorId !== userId) {
    return NextResponse.json(
      { message: "Можно удалять только свои сообщения" },
      { status: 403 }
    )
  }

  await prisma.channelMessage.delete({
    where: { id: messageId },
  })
  await deleteUploadedFileByUrl(existing.mediaUrl)

  return NextResponse.json({ ok: true }, { status: 200 })
}
