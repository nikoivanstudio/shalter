"use client"

import { BotIcon } from "lucide-react"
import { useState } from "react"

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

  if (avatarUrl && failedAvatarUrl !== avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={alt}
        className={`rounded-full object-cover ${className}`.trim()}
        onError={() => setFailedAvatarUrl(avatarUrl)}
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
