export const MEDIA_KIND_VALUES = ["FILE", "VOICE", "VIDEO_NOTE"] as const

export type MediaKind = (typeof MEDIA_KIND_VALUES)[number]

export type MediaAttachment = {
  kind: MediaKind
  url: string
  name: string
  mime: string
  size: number
}

export type MediaAttachmentList = MediaAttachment[]

export const DEFAULT_MEDIA_LABELS: Record<MediaKind, string> = {
  FILE: "Файл",
  VOICE: "Голосовое сообщение",
  VIDEO_NOTE: "Видеокружок",
}
