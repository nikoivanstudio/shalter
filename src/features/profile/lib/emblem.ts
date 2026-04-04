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
