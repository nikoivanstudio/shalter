export const MEDIA_KIND_VALUES = ["FILE"] as const

export type MediaKind = (typeof MEDIA_KIND_VALUES)[number]

export type MediaAttachment = {
  kind: MediaKind
  url: string
  name: string
  mime: string
  size: number
}

export const DEFAULT_MEDIA_LABELS: Record<MediaKind, string> = {
  FILE: "Файл",
}
