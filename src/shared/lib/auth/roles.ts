export const USER_ROLE = "user"
export const PREMIUM_ROLE = "premium"
export const DEVELOPER_ROLE = "developer"
export const ADMIN_ROLE = "admin"
export const OWNER_ROLE = "owner"

export const MANAGED_USER_ROLES = [
  USER_ROLE,
  PREMIUM_ROLE,
  DEVELOPER_ROLE,
] as const

export type ManagedUserRole = (typeof MANAGED_USER_ROLES)[number]

export function normalizeRole(role?: string | null) {
  return role?.trim().toLowerCase() ?? USER_ROLE
}

export function hasAdministrativeAccess(role?: string | null) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole === ADMIN_ROLE || normalizedRole === OWNER_ROLE
}

export function canAssignManagedRole(role?: string | null) {
  return hasAdministrativeAccess(role)
}

export function isManagedUserRole(role: string): role is ManagedUserRole {
  return MANAGED_USER_ROLES.includes(role as ManagedUserRole)
}
