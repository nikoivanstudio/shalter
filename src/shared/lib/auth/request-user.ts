import { type NextRequest } from "next/server"

import { touchUserActivity } from "@/shared/lib/user-activity"
import {
  AUTH_SESSION_COOKIE,
  AUTH_TOKEN_COOKIE,
  verifyAuthToken,
} from "@/shared/lib/auth/session"

export async function getAuthorizedUserIdFromRequest(
  request: NextRequest,
  options?: { touchActivity?: boolean }
) {
  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value
  const sessionId = request.cookies.get(AUTH_SESSION_COOKIE)?.value

  if (!token || !sessionId) {
    return null
  }

  const payload = await verifyAuthToken(token)
  if (!payload || payload.sid !== sessionId) {
    return null
  }

  if (options?.touchActivity !== false) {
    await touchUserActivity(payload.userId)
  }

  return payload.userId
}
