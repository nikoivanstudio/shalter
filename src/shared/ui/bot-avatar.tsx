"use client"

import { BotIcon } from "lucide-react"
import { useState } from "react"

function normalizeAvatarUrl(avatarUrl?: string | null) {
  const value = avatarUrl?.trim()

  if (!value) {
    return null
  }

  if (/^https?:\/\//i.test(value) || value.startsWith("/")) {
    return value
  }

  if (value.startsWith("api/uploads/") || value.startsWith("uploads/")) {
    return `/${value}`
  }

  if (value.startsWith("storage/uploads/")) {
    return `/api/uploads/${value.slice("storage/uploads/".length)}`
  }

  return `/${value}`
}

export function BotAvatar({
  avatarUrl,
  alt = "Bot avatar",
  className = "",
  iconClassName = "",
}: {
  avatarUrl?: string | null
  alt?: string
  className?: string
  iconClassName?: string
}) {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null)
  const normalizedAvatarUrl = normalizeAvatarUrl(avatarUrl)

  if (normalizedAvatarUrl && failedAvatarUrl !== normalizedAvatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={normalizedAvatarUrl}
        alt={alt}
        className={`rounded-full object-cover ${className}`.trim()}
        onError={() => setFailedAvatarUrl(normalizedAvatarUrl)}
      />
    )
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full border border-cyan-200/60 bg-[radial-gradient(circle_at_30%_30%,rgba(103,232,249,0.95),rgba(14,116,144,0.92)_58%,rgba(15,23,42,0.98))] shadow-lg shadow-cyan-500/20 ${className}`.trim()}
    >
      <BotIcon className={`text-white drop-shadow-sm ${iconClassName}`.trim()} />
    </div>
  )
}
