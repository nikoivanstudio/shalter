"use client"

import { useState } from "react"

import { buildEmblem, getEmblemTone } from "@/features/profile/lib/emblem"

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

export function UserAvatar({
  firstName,
  lastName,
  avatarTone,
  avatarUrl,
  className = "",
  textClassName = "text-sm font-semibold",
}: {
  firstName: string
  lastName: string | null
  avatarTone?: string | null
  avatarUrl?: string | null
  className?: string
  textClassName?: string
}) {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null)
  const emblem = buildEmblem(firstName, lastName)
  const emblemTone = getEmblemTone(firstName, lastName, avatarTone ?? null)
  const normalizedAvatarUrl = normalizeAvatarUrl(avatarUrl)

  if (normalizedAvatarUrl && failedAvatarUrl !== normalizedAvatarUrl) {
    return (
      <img
        src={normalizedAvatarUrl}
        alt={`${firstName} ${lastName ?? ""}`.trim() || "Аватар"}
        className={`rounded-full object-cover ${className}`.trim()}
        onError={() => setFailedAvatarUrl(normalizedAvatarUrl)}
      />
    )
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full border border-white/55 shadow-lg shadow-sky-500/10 ${emblemTone} ${textClassName} ${className}`.trim()}
    >
      {emblem}
    </div>
  )
}
