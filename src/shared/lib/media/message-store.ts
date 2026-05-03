import { prisma } from "@/shared/lib/db/prisma"

import type { MediaAttachment, MediaKind } from "./constants"

type MessageAuthor = {
  id: number
  firstName: string
  lastName: string | null
  avatarTone: string | null
  avatarUrl: string | null
}

type DialogMessageRow = {
  id: number
  content: string
  status: string | null
  created_at: Date | string
  dialog_id: number
  author_id: number
  first_name: string
  last_name: string | null
  avatar_tone: string | null
  avatar_url: string | null
  media_kind: MediaKind | null
  media_url: string | null
  media_name: string | null
  media_mime: string | null
  media_size: number | null
}

type ChannelMessageRow = {
  id: number
  content: string
  created_at: Date | string
  channel_id: number
  author_id: number
  first_name: string
  last_name: string | null
  avatar_tone: string | null
  avatar_url: string | null
  media_kind: MediaKind | null
  media_url: string | null
  media_name: string | null
  media_mime: string | null
  media_size: number | null
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapAttachment(row: {
  media_kind: MediaKind | null
  media_url: string | null
  media_name: string | null
  media_mime: string | null
  media_size: number | null
}): MediaAttachment | null {
  if (!row.media_kind || !row.media_url || !row.media_name || !row.media_mime || row.media_size === null) {
    return null
  }

  return {
    kind: row.media_kind,
    url: row.media_url,
    name: row.media_name,
    mime: row.media_mime,
    size: row.media_size,
  }
}

function mapAuthor(row: {
  author_id: number
  first_name: string
  last_name: string | null
  avatar_tone: string | null
  avatar_url: string | null
}): MessageAuthor {
  return {
    id: row.author_id,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarTone: row.avatar_tone,
    avatarUrl: row.avatar_url,
  }
}

export async function getDialogMessages(dialogId: number) {
  const rows = await prisma.$queryRawUnsafe<DialogMessageRow[]>(
    `
      select
        m.id,
        m.content,
        m.status,
        m.created_at,
        m.dialog_id,
        u.id as author_id,
        u.first_name,
        u.last_name,
        u.avatar_tone,
        u.avatar_url,
        m.media_kind,
        m.media_url,
        m.media_name,
        m.media_mime,
        m.media_size
      from messages m
      inner join users u on u.id = m."authorId"
      where m.dialog_id = $1
      order by m.id asc
    `,
    dialogId
  )

  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    status: row.status,
    createdAt: toIsoString(row.created_at),
    dialogId: row.dialog_id,
    author: mapAuthor(row),
    attachment: mapAttachment(row),
  }))
}

export async function createDialogMessage(input: {
  content: string
  dialogId: number
  authorId: number
  status: string
  attachment?: MediaAttachment | null
}) {
  const rows = await prisma.$queryRawUnsafe<DialogMessageRow[]>(
    `
      insert into messages (
        content,
        status,
        created_at,
        updated_at,
        dialog_id,
        "authorId",
        media_kind,
        media_url,
        media_name,
        media_mime,
        media_size
      )
      values ($1, $2, now(), null, $3, $4, $5, $6, $7, $8, $9)
      returning
        id,
        content,
        status,
        created_at,
        dialog_id,
        "authorId" as author_id,
        media_kind,
        media_url,
        media_name,
        media_mime,
        media_size
    `,
    input.content,
    input.status,
    input.dialogId,
    input.authorId,
    input.attachment?.kind ?? null,
    input.attachment?.url ?? null,
    input.attachment?.name ?? null,
    input.attachment?.mime ?? null,
    input.attachment?.size ?? null
  )

  const created = rows[0]
  const authorRows = await prisma.$queryRawUnsafe<
    Array<{
      id: number
      first_name: string
      last_name: string | null
      avatar_tone: string | null
      avatar_url: string | null
    }>
  >(
    `
      select id, first_name, last_name, avatar_tone, avatar_url
      from users
      where id = $1
      limit 1
    `,
    input.authorId
  )
  const author = authorRows[0]

  return {
    id: created.id,
    content: created.content,
    status: created.status,
    createdAt: toIsoString(created.created_at),
    dialogId: created.dialog_id,
    author: {
      id: author.id,
      firstName: author.first_name,
      lastName: author.last_name,
      avatarTone: author.avatar_tone,
      avatarUrl: author.avatar_url,
    },
    attachment: mapAttachment(created),
  }
}

export async function getDialogMessageMedia(messageId: number, dialogId: number) {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ media_kind: MediaKind | null; media_url: string | null }>
  >(
    `
      select media_kind, media_url
      from messages
      where id = $1 and dialog_id = $2
      limit 1
    `,
    messageId,
    dialogId
  )

  return rows[0] ?? null
}

export async function getChannelMessages(channelId: number) {
  const rows = await prisma.$queryRawUnsafe<ChannelMessageRow[]>(
    `
      select
        m.id,
        m.content,
        m.created_at,
        m.channel_id,
        u.id as author_id,
        u.first_name,
        u.last_name,
        u.avatar_tone,
        u.avatar_url,
        m.media_kind,
        m.media_url,
        m.media_name,
        m.media_mime,
        m.media_size
      from channel_messages m
      inner join users u on u.id = m.author_id
      where m.channel_id = $1
      order by m.id asc
    `,
    channelId
  )

  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    channelId: row.channel_id,
    createdAt: toIsoString(row.created_at),
    author: mapAuthor(row),
    attachment: mapAttachment(row),
  }))
}

export async function createChannelMessage(input: {
  content: string
  channelId: number
  authorId: number
  attachment?: MediaAttachment | null
}) {
  const rows = await prisma.$queryRawUnsafe<ChannelMessageRow[]>(
    `
      insert into channel_messages (
        channel_id,
        author_id,
        content,
        created_at,
        updated_at,
        media_kind,
        media_url,
        media_name,
        media_mime,
        media_size
      )
      values ($1, $2, $3, now(), now(), $4, $5, $6, $7, $8)
      returning
        id,
        content,
        created_at,
        channel_id,
        author_id,
        media_kind,
        media_url,
        media_name,
        media_mime,
        media_size
    `,
    input.channelId,
    input.authorId,
    input.content,
    input.attachment?.kind ?? null,
    input.attachment?.url ?? null,
    input.attachment?.name ?? null,
    input.attachment?.mime ?? null,
    input.attachment?.size ?? null
  )

  const created = rows[0]
  const authorRows = await prisma.$queryRawUnsafe<
    Array<{
      id: number
      first_name: string
      last_name: string | null
      avatar_tone: string | null
      avatar_url: string | null
    }>
  >(
    `
      select id, first_name, last_name, avatar_tone, avatar_url
      from users
      where id = $1
      limit 1
    `,
    input.authorId
  )
  const author = authorRows[0]

  return {
    id: created.id,
    content: created.content,
    channelId: created.channel_id,
    createdAt: toIsoString(created.created_at),
    author: {
      id: author.id,
      firstName: author.first_name,
      lastName: author.last_name,
      avatarTone: author.avatar_tone,
      avatarUrl: author.avatar_url,
    },
    attachment: mapAttachment(created),
  }
}
