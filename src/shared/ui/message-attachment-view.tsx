import type { MediaAttachment } from "@/shared/lib/media/constants"

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function MessageAttachmentView({
  attachment,
  compact = false,
}: {
  attachment: MediaAttachment | null | undefined
  compact?: boolean
}) {
  if (!attachment) {
    return null
  }

  if (attachment.kind === "VIDEO_CIRCLE") {
    return (
      <div className="mt-2">
        <video
          src={attachment.url}
          controls
          playsInline
          preload="metadata"
          className={`${compact ? "size-32" : "size-40"} rounded-full object-cover bg-black/80`}
        />
      </div>
    )
  }

  if (attachment.kind === "VOICE") {
    return (
      <div className="mt-2 rounded-2xl bg-black/10 p-2">
        <audio src={attachment.url} controls preload="metadata" className="w-full max-w-64" />
      </div>
    )
  }

  if (attachment.mime.startsWith("image/")) {
    return (
      <div className="mt-2 space-y-2">
        <img
          src={attachment.url}
          alt={attachment.name}
          className={`max-w-full rounded-2xl object-cover ${compact ? "max-h-56" : "max-h-80"}`}
        />
        <a
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
        >
          {attachment.name}
        </a>
      </div>
    )
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex max-w-72 items-center justify-between gap-3 rounded-2xl border border-current/15 bg-black/5 px-3 py-2 text-left"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{attachment.name}</span>
        <span className="block text-xs opacity-75">{formatBytes(attachment.size)}</span>
      </span>
      <span className="shrink-0 text-xs underline underline-offset-2">Открыть</span>
    </a>
  )
}
