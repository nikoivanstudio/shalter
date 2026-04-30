import { buildEmblem, getEmblemTone } from "@/features/profile/lib/emblem"

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
  const emblem = buildEmblem(firstName, lastName)
  const emblemTone = getEmblemTone(firstName, lastName, avatarTone ?? null)

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${firstName} ${lastName ?? ""}`.trim() || "Аватар"}
        className={`rounded-full object-cover ${className}`.trim()}
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
