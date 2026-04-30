import { randomUUID } from "crypto"
import { promises as fs } from "fs"
import path from "path"

import type { MediaKind } from "./constants"

type SavedUpload = {
  url: string
  name: string
  mime: string
  size: number
}

const PUBLIC_DIR = path.join(process.cwd(), "public")
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads")

const MEDIA_RULES: Record<
  MediaKind,
  { folder: string; maxBytes: number; mimePrefixes: string[] }
> = {
  FILE: {
    folder: "messages/files",
    maxBytes: 20 * 1024 * 1024,
    mimePrefixes: [],
  },
  VOICE: {
    folder: "messages/voice",
    maxBytes: 20 * 1024 * 1024,
    mimePrefixes: ["audio/"],
  },
  VIDEO_CIRCLE: {
    folder: "messages/circles",
    maxBytes: 40 * 1024 * 1024,
    mimePrefixes: ["video/"],
  },
}

function sanitizeBaseName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
}

function getExtension(fileName: string, mimeType: string) {
  const ext = path.extname(fileName).toLowerCase()
  if (ext) {
    return ext
  }

  if (mimeType.startsWith("audio/ogg")) {
    return ".ogg"
  }

  if (mimeType.startsWith("audio/mpeg")) {
    return ".mp3"
  }

  if (mimeType.startsWith("audio/webm")) {
    return ".webm"
  }

  if (mimeType.startsWith("video/mp4")) {
    return ".mp4"
  }

  if (mimeType.startsWith("video/webm")) {
    return ".webm"
  }

  if (mimeType.startsWith("image/png")) {
    return ".png"
  }

  if (mimeType.startsWith("image/jpeg")) {
    return ".jpg"
  }

  if (mimeType.startsWith("image/webp")) {
    return ".webp"
  }

  return ""
}

async function writeBrowserFile(file: File, folder: string) {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const ext = getExtension(file.name, file.type)
  const safeName = sanitizeBaseName(path.basename(file.name, path.extname(file.name))) || "upload"
  const fileName = `${Date.now()}-${randomUUID()}-${safeName}${ext}`
  const outputDir = path.join(UPLOADS_DIR, folder)
  const outputPath = path.join(outputDir, fileName)

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(outputPath, buffer)

  return {
    url: `/uploads/${folder}/${fileName}`.replace(/\\/g, "/"),
    name: file.name || fileName,
    mime: file.type || "application/octet-stream",
    size: file.size,
  } satisfies SavedUpload
}

export function validateAvatarFile(file: File) {
  if (!file || file.size === 0) {
    return "Выберите файл аватарки"
  }

  if (!file.type.startsWith("image/")) {
    return "Аватарка должна быть изображением"
  }

  if (file.size > 5 * 1024 * 1024) {
    return "Аватарка должна быть не больше 5 МБ"
  }

  return null
}

export async function saveAvatarFile(file: File) {
  return writeBrowserFile(file, "avatars")
}

export function validateMessageFile(kind: MediaKind, file: File) {
  const rule = MEDIA_RULES[kind]

  if (!file || file.size === 0) {
    return "Выберите файл"
  }

  if (rule.mimePrefixes.length > 0 && !rule.mimePrefixes.some((prefix) => file.type.startsWith(prefix))) {
    if (kind === "VOICE") {
      return "Голосовое сообщение должно быть аудиофайлом"
    }

    if (kind === "VIDEO_CIRCLE") {
      return "Кружок должен быть видеофайлом"
    }
  }

  if (file.size > rule.maxBytes) {
    if (kind === "VIDEO_CIRCLE") {
      return "Кружок должен быть не больше 40 МБ"
    }

    if (kind === "VOICE") {
      return "Голосовое сообщение должно быть не больше 20 МБ"
    }

    return "Файл должен быть не больше 20 МБ"
  }

  return null
}

export async function saveMessageFile(kind: MediaKind, file: File) {
  return writeBrowserFile(file, MEDIA_RULES[kind].folder)
}

export async function deleteUploadedFileByUrl(url: string | null | undefined) {
  if (!url || !url.startsWith("/uploads/")) {
    return
  }

  const normalized = url.replace(/^\/+/, "")
  const absolutePath = path.join(PUBLIC_DIR, normalized)

  if (!absolutePath.startsWith(UPLOADS_DIR)) {
    return
  }

  await fs.unlink(absolutePath).catch(() => null)
}
