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
  attachment: MediaAttachment | MediaAttachment[] | null | undefined
  compact?: boolean
}) {
  const attachments = Array.isArray(attachment) ? attachment : attachment ? [attachment] : []

  if (attachments.length === 0) {
    return null
  }

  return (
    <div className="mt-2 space-y-3">
      {attachments.map((item) => {
        if (item.kind === "VOICE" || item.mime.startsWith("audio/")) {
          return (
            <div key={`${item.url}-${item.name}`} className="space-y-2">
              <audio src={item.url} controls preload="metadata" className="w-full max-w-72" />
              <p className="text-xs opacity-75">{item.name}</p>
            </div>
          )
        }

        if (item.mime.startsWith("image/")) {
          return (
            <div key={`${item.url}-${item.name}`} className="space-y-2">
              <img
                src={item.url}
                alt={item.name}
                className={`max-w-full rounded-2xl object-cover ${compact ? "max-h-56" : "max-h-80"}`}
              />
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
              >
                {item.name}
              </a>
            </div>
          )
        }

        if (item.mime.startsWith("video/")) {
          const isVideoNote = item.kind === "VIDEO_NOTE"

          return (
            <div key={`${item.url}-${item.name}`} className="space-y-2">
              <video
                src={item.url}
                controls
                preload="metadata"
                className={
                  isVideoNote
                    ? "size-44 rounded-full bg-black object-cover"
                    : `max-w-full rounded-2xl bg-black ${compact ? "max-h-56" : "max-h-80"}`
                }
              />
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
              >
                {item.name}
              </a>
            </div>
          )
        }

        return (
          <a
            key={`${item.url}-${item.name}`}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="flex max-w-72 items-center justify-between gap-3 rounded-2xl border border-current/15 bg-black/5 px-3 py-2 text-left"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{item.name}</span>
              <span className="block text-xs opacity-75">{formatBytes(item.size)}</span>
            </span>
            <span className="shrink-0 text-xs underline underline-offset-2">Open</span>
          </a>
        )
      })}
    </div>
  )
}
