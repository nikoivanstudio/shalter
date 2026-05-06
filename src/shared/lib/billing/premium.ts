import { PREMIUM_ROLE, USER_ROLE, normalizeRole } from "@/shared/lib/auth/roles"

export function extendPremiumUntil(current: Date | null | undefined, months: number) {
  const base = current && current.getTime() > Date.now() ? new Date(current) : new Date()
  const next = new Date(base)
  next.setMonth(next.getMonth() + months)
  return next
}

export function resolveRoleAfterPremiumPurchase(role: string) {
  const normalized = normalizeRole(role)
  return normalized === PREMIUM_ROLE || normalized === USER_ROLE ? PREMIUM_ROLE : role
}
