import { prisma } from "@/shared/lib/db/prisma"

import type { MediaAttachment } from "./constants"

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapAttachment(item: {
  kind: string
  url: string
  name: string
  mime: string
  size: number
}): MediaAttachment {
  return {
    kind: item.kind as MediaAttachment["kind"],
    url: item.url,
    name: item.name,
    mime: item.mime,
    size: item.size,
  }
}

function mapLegacyAttachment(row: {
  mediaKind?: string | null
  mediaUrl?: string | null
  mediaName?: string | null
  mediaMime?: string | null
  mediaSize?: number | null
}) {
  if (!row.mediaKind || !row.mediaUrl || !row.mediaName || !row.mediaMime || row.mediaSize == null) {
    return []
  }

  return [
    {
      kind: row.mediaKind as MediaAttachment["kind"],
      url: row.mediaUrl,
      name: row.mediaName,
      mime: row.mediaMime,
      size: row.mediaSize,
    },
  ] satisfies MediaAttachment[]
}

export async function getDialogMessages(dialogId: number) {
  const rows = await prisma.message.findMany({
    where: { dialogId },
    orderBy: { id: "asc" },
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
      attachments: {
        orderBy: { position: "asc" },
      },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    status: row.status,
    createdAt: toIsoString(row.createdAt),
    dialogId: row.dialogId,
    author: row.author,
    attachment:
      (row.attachments ?? []).length > 0
        ? (row.attachments ?? []).map(mapAttachment)
        : mapLegacyAttachment(row),
  }))
}

export async function createDialogMessage(input: {
  content: string
  dialogId: number
  authorId: number
  status: string
  attachments?: MediaAttachment[]
}) {
  const created = await prisma.message.create({
    data: {
      content: input.content,
      status: input.status,
      dialogId: input.dialogId,
      authorId: input.authorId,
      attachments: input.attachments?.length
        ? {
            create: input.attachments.map((attachment, index) => ({
              kind: attachment.kind,
              url: attachment.url,
              name: attachment.name,
              mime: attachment.mime,
              size: attachment.size,
              position: index,
            })),
          }
        : undefined,
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
      attachments: {
        orderBy: { position: "asc" },
      },
    },
  })

  return {
    id: created.id,
    content: created.content,
    status: created.status,
    createdAt: toIsoString(created.createdAt),
    dialogId: created.dialogId,
    author: created.author,
    attachment: (created.attachments ?? []).map(mapAttachment),
  }
}

export async function getDialogMessageMedia(messageId: number, dialogId: number) {
  const row = await prisma.message.findFirst({
    where: { id: messageId, dialogId },
    select: {
      mediaKind: true,
      mediaUrl: true,
      attachments: {
        orderBy: { position: "asc" },
        select: {
          url: true,
        },
      },
    },
  })

  if (!row) {
    return null
  }

  return {
    media_kind: row.mediaKind,
    media_url: row.mediaUrl,
    attachment_urls: row.attachments.map((item) => item.url),
  }
}

export async function getChannelMessages(channelId: number) {
  const rows = await prisma.channelMessage.findMany({
    where: { channelId },
    orderBy: { id: "asc" },
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
      attachments: {
        orderBy: { position: "asc" },
      },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    channelId: row.channelId,
    createdAt: toIsoString(row.createdAt),
    author: row.author,
    attachment:
      row.attachments.length > 0
        ? row.attachments.map(mapAttachment)
        : mapLegacyAttachment(row),
  }))
}

export async function createChannelMessage(input: {
  content: string
  channelId: number
  authorId: number
  attachments?: MediaAttachment[]
}) {
  const created = await prisma.channelMessage.create({
    data: {
      channelId: input.channelId,
      authorId: input.authorId,
      content: input.content,
      attachments: input.attachments?.length
        ? {
            create: input.attachments.map((attachment, index) => ({
              kind: attachment.kind,
              url: attachment.url,
              name: attachment.name,
              mime: attachment.mime,
              size: attachment.size,
              position: index,
            })),
          }
        : undefined,
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
      attachments: {
        orderBy: { position: "asc" },
      },
    },
  })

  return {
    id: created.id,
    content: created.content,
    channelId: created.channelId,
    createdAt: toIsoString(created.createdAt),
    author: created.author,
    attachment: (created.attachments ?? []).map(mapAttachment),
  }
}
