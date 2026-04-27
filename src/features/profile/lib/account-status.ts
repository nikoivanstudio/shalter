import {
  ADMIN_ROLE,
  DEVELOPER_ROLE,
  OWNER_ROLE,
  PREMIUM_ROLE,
  normalizeRole,
} from "@/shared/lib/auth/roles"

type AccountStatusInput = {
  role?: string | null
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  isBlocked?: boolean | null
}

const TECHNICAL_DEVELOPER_EMAILS = new Set(["matveykanico@gmail.com"])
const BUSINESS_ACCOUNT_NAMES = new Set([
  "матвей николаенко",
  "matvey nikolaenko",
])

function buildFullName(firstName?: string | null, lastName?: string | null) {
  return `${firstName?.trim() ?? ""} ${lastName?.trim() ?? ""}`.trim().toLowerCase()
}

export function getAccountStatusLabel({ role, email, firstName, lastName, isBlocked }: AccountStatusInput) {
  const normalizedRole = normalizeRole(role)
  const normalizedEmail = email?.trim().toLowerCase() ?? ""
  const normalizedFullName = buildFullName(firstName, lastName)

  if (isBlocked) {
    return "Аккаунт заблокирован"
  }

  if (normalizedRole === OWNER_ROLE) {
    return "Владелец мессенджера"
  }

  if (BUSINESS_ACCOUNT_NAMES.has(normalizedFullName)) {
    return "Бизнес аккаунт"
  }

  if (normalizedRole === ADMIN_ROLE) {
    return "Администратор"
  }

  if (normalizedRole === PREMIUM_ROLE) {
    return "Премиум"
  }

  if (normalizedRole === DEVELOPER_ROLE) {
    return "Разработчик"
  }

  if (TECHNICAL_DEVELOPER_EMAILS.has(normalizedEmail)) {
    return "Разработчик"
  }

  return "Пользователь"
}

export function getAccountStatusTone(input: AccountStatusInput) {
  const label = getAccountStatusLabel(input)

  if (label === "Владелец мессенджера") {
    return "border-amber-300/80 bg-amber-100 text-amber-800 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-200"
  }

  if (label === "Аккаунт заблокирован") {
    return "border-zinc-300/80 bg-zinc-200 text-zinc-800 dark:border-zinc-700/80 dark:bg-zinc-900 dark:text-zinc-100"
  }

  if (label === "Бизнес аккаунт") {
    return "border-teal-300/80 bg-teal-100 text-teal-800 dark:border-teal-900/80 dark:bg-teal-950/40 dark:text-teal-200"
  }

  if (label === "Администратор") {
    return "border-rose-300/80 bg-rose-100 text-rose-800 dark:border-rose-900/80 dark:bg-rose-950/40 dark:text-rose-200"
  }

  if (label === "Премиум") {
    return "border-violet-300/80 bg-violet-100 text-violet-800 dark:border-violet-900/80 dark:bg-violet-950/40 dark:text-violet-200"
  }

  if (label === "Разработчик") {
    return "border-sky-300/80 bg-sky-100 text-sky-800 dark:border-sky-900/80 dark:bg-sky-950/40 dark:text-sky-200"
  }

  return "border-border/80 bg-muted text-muted-foreground"
}
