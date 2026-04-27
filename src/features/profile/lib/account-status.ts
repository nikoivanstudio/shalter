type AccountStatusInput = {
  role?: string | null
  email?: string | null
}

const TECHNICAL_DEVELOPER_EMAILS = new Set(["matveykanico@gmail.com"])

function normalizeRole(role?: string | null) {
  return role?.trim().toLowerCase() ?? "user"
}

export function getAccountStatusLabel({ role, email }: AccountStatusInput) {
  const normalizedRole = normalizeRole(role)
  const normalizedEmail = email?.trim().toLowerCase() ?? ""

  if (normalizedRole === "owner") {
    return "Владелец мессенджера"
  }

  if (TECHNICAL_DEVELOPER_EMAILS.has(normalizedEmail)) {
    return "Технический разработчик"
  }

  if (normalizedRole === "admin") {
    return "Админ"
  }

  return "Пользователь"
}

export function getAccountStatusTone(input: AccountStatusInput) {
  const label = getAccountStatusLabel(input)

  if (label === "Владелец мессенджера") {
    return "border-amber-300/80 bg-amber-100 text-amber-800 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-200"
  }

  if (label === "Технический разработчик") {
    return "border-sky-300/80 bg-sky-100 text-sky-800 dark:border-sky-900/80 dark:bg-sky-950/40 dark:text-sky-200"
  }

  if (label === "Админ") {
    return "border-rose-300/80 bg-rose-100 text-rose-800 dark:border-rose-900/80 dark:bg-rose-950/40 dark:text-rose-200"
  }

  return "border-border/80 bg-muted text-muted-foreground"
}
