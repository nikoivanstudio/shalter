const EMBLEM_TONES = [
  "border-rose-200/80 bg-rose-100 text-rose-700 dark:border-rose-900/80 dark:bg-rose-950/40 dark:text-rose-200",
  "border-orange-200/80 bg-orange-100 text-orange-700 dark:border-orange-900/80 dark:bg-orange-950/40 dark:text-orange-200",
  "border-amber-200/80 bg-amber-100 text-amber-700 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-200",
  "border-emerald-200/80 bg-emerald-100 text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/40 dark:text-emerald-200",
  "border-cyan-200/80 bg-cyan-100 text-cyan-700 dark:border-cyan-900/80 dark:bg-cyan-950/40 dark:text-cyan-200",
  "border-sky-200/80 bg-sky-100 text-sky-700 dark:border-sky-900/80 dark:bg-sky-950/40 dark:text-sky-200",
  "border-indigo-200/80 bg-indigo-100 text-indigo-700 dark:border-indigo-900/80 dark:bg-indigo-950/40 dark:text-indigo-200",
  "border-fuchsia-200/80 bg-fuchsia-100 text-fuchsia-700 dark:border-fuchsia-900/80 dark:bg-fuchsia-950/40 dark:text-fuchsia-200",
]

export function buildEmblem(firstName: string, lastName: string | null) {
  const first = firstName.trim().charAt(0).toUpperCase()
  const last = (lastName ?? "").trim().charAt(0).toUpperCase()

  if (first && last) {
    return `${first}${last}`
  }

  if (first) {
    return first
  }

  return "U"
}

export function getEmblemTone(firstName: string, lastName: string | null) {
  const emblem = buildEmblem(firstName, lastName)
  const seed = Array.from(emblem).reduce(
    (total, letter, index) => total + letter.charCodeAt(0) * (index + 17),
    0
  )

  return EMBLEM_TONES[seed % EMBLEM_TONES.length]
}
