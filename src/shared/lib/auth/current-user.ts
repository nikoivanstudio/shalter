import { cookies } from "next/headers"

import { prisma } from "@/shared/lib/db/prisma"
import { touchUserActivity } from "@/shared/lib/user-activity"

import {
  AUTH_SESSION_COOKIE,
  AUTH_TOKEN_COOKIE,
  verifyAuthToken,
} from "./session"

export type CurrentUser = {
  id: number
  email: string
  firstName: string
  lastName: string | null
  phone: string
  role: string
  avatarId: number | null
  lastSeenAt: Date | null
}

export async function getCurrentUser(options?: { touchActivity?: boolean }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value
  const sessionId = cookieStore.get(AUTH_SESSION_COOKIE)?.value

  if (!token || !sessionId) {
    return null
  }

  const payload = await verifyAuthToken(token)
  if (!payload || payload.sid !== sessionId) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      avatarId: true,
      lastSeenAt: true,
    },
  })

  if (user && options?.touchActivity !== false) {
    await touchUserActivity(user.id)
  }

  return user
}
