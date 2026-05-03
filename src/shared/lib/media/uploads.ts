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
const LEGACY_UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads")
const SERVER_UPLOADS_DIR = path.resolve(
  process.env.UPLOADS_STORAGE_DIR?.trim() || path.join(process.cwd(), "storage", "uploads")
)
const SERVER_UPLOADS_PREFIX = "/api/uploads/"
const LEGACY_UPLOADS_PREFIX = "/uploads/"

const MB = 1024 * 1024
const GB = 1024 * MB

const DOCUMENT_MAX_BYTES = 25 * MB
const PHOTO_MAX_BYTES = 1 * GB
const VIDEO_MAX_BYTES = 2 * GB

const MEDIA_RULES: Record<
  MediaKind,
  { folder: string; maxBytes: number; mimePrefixes: string[] }
> = {
  FILE: {
    folder: "messages/files",
    maxBytes: VIDEO_MAX_BYTES,
    mimePrefixes: [],
  },
}

function sanitizeBaseName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
}

function normalizeRelativePath(value: string) {
  return value
    .split(/[\\/]+/)
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/")
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

  if (mimeType.startsWith("image/gif")) {
    return ".gif"
  }

  return ""
}

function ensureInsideBase(baseDir: string, relativePath: string) {
  const absolutePath = path.resolve(baseDir, relativePath)
  const relativeToBase = path.relative(baseDir, absolutePath)

  if (
    relativeToBase.startsWith("..") ||
    path.isAbsolute(relativeToBase) ||
    relativeToBase.includes("\0")
  ) {
    return null
  }

  return absolutePath
}

async function writeBrowserFile(file: File, folder: string) {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const ext = getExtension(file.name, file.type)
  const safeName = sanitizeBaseName(path.basename(file.name, path.extname(file.name))) || "upload"
  const fileName = `${Date.now()}-${randomUUID()}-${safeName}${ext}`
  const relativePath = normalizeRelativePath(`${folder}/${fileName}`)
  const outputPath = ensureInsideBase(SERVER_UPLOADS_DIR, relativePath)

  if (!outputPath) {
    throw new Error("Некорректный путь для загрузки файла")
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, buffer)

  return {
    url: `${SERVER_UPLOADS_PREFIX}${relativePath}`.replace(/\\/g, "/"),
    name: file.name || fileName,
    mime: file.type || "application/octet-stream",
    size: file.size,
  } satisfies SavedUpload
}

function getFileSizeLimitMessage(file: File) {
  if (file.type.startsWith("video/")) {
    return {
      maxBytes: VIDEO_MAX_BYTES,
      message: "Видео должно быть не больше 2 ГБ",
    }
  }

  if (file.type.startsWith("image/")) {
    return {
      maxBytes: PHOTO_MAX_BYTES,
      message: "Фото должно быть не больше 1 ГБ",
    }
  }

  return {
    maxBytes: DOCUMENT_MAX_BYTES,
    message: "Документ должен быть не больше 25 МБ",
  }
}

export function validateAvatarFile(file: File) {
  if (!file || file.size === 0) {
    return "Выберите файл аватарки"
  }

  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    return "Аватарка должна быть картинкой PNG, JPG, WEBP или GIF"
  }

  if (file.size > 5 * MB) {
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

  if (
    rule.mimePrefixes.length > 0 &&
    !rule.mimePrefixes.some((prefix) => file.type.startsWith(prefix))
  ) {
    return "Некорректный формат файла"
  }

  const { maxBytes, message } = getFileSizeLimitMessage(file)

  if (file.size > Math.min(rule.maxBytes, maxBytes)) {
    return message
  }

  return null
}

export async function saveMessageFile(kind: MediaKind, file: File) {
  return writeBrowserFile(file, MEDIA_RULES[kind].folder)
}

function resolveUploadUrl(url: string) {
  if (url.startsWith(SERVER_UPLOADS_PREFIX)) {
    return {
      baseDir: SERVER_UPLOADS_DIR,
      relativePath: normalizeRelativePath(url.slice(SERVER_UPLOADS_PREFIX.length)),
    }
  }

  if (url.startsWith(LEGACY_UPLOADS_PREFIX)) {
    return {
      baseDir: LEGACY_UPLOADS_DIR,
      relativePath: normalizeRelativePath(url.slice(LEGACY_UPLOADS_PREFIX.length)),
    }
  }

  return null
}

export function resolveServerUploadPath(relativePath: string) {
  const normalized = normalizeRelativePath(relativePath)
  if (!normalized) {
    return null
  }

  return ensureInsideBase(SERVER_UPLOADS_DIR, normalized)
}

export async function deleteUploadedFileByUrl(url: string | null | undefined) {
  if (!url) {
    return
  }

  const resolved = resolveUploadUrl(url)
  if (!resolved) {
    return
  }

  const absolutePath = ensureInsideBase(resolved.baseDir, resolved.relativePath)
  if (!absolutePath) {
    return
  }

  await fs.unlink(absolutePath).catch(() => null)
}
