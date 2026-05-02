import { promises as fs } from "fs"
import path from "path"

import { resolveServerUploadPath } from "@/shared/lib/media/uploads"

export const runtime = "nodejs"

function getContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()

  switch (ext) {
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".webp":
      return "image/webp"
    case ".gif":
      return "image/gif"
    case ".mp4":
      return "video/mp4"
    case ".webm":
      return "video/webm"
    case ".ogg":
      return "audio/ogg"
    case ".mp3":
      return "audio/mpeg"
    case ".pdf":
      return "application/pdf"
    case ".txt":
      return "text/plain; charset=utf-8"
    default:
      return "application/octet-stream"
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await context.params
  const relativePath = Array.isArray(parts) ? parts.join("/") : ""
  const absolutePath = resolveServerUploadPath(relativePath)

  if (!absolutePath) {
    return new Response("Not found", { status: 404 })
  }

  const file = await fs.readFile(absolutePath).catch(() => null)
  if (!file) {
    return new Response("Not found", { status: 404 })
  }

  return new Response(file, {
    status: 200,
    headers: {
      "Content-Type": getContentType(absolutePath),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
