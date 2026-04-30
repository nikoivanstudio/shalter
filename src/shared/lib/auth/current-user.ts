import { cookies } from "next/headers"

import type { EmblemToneId } from "@/features/profile/lib/emblem"
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
  avatarTone: EmblemToneId | null
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
      avatarTone: true,
      isBlocked: true,
      lastSeenAt: true,
    },
  })

  if (user?.isBlocked) {
    return null
  }

  if (user && options?.touchActivity !== false) {
    await touchUserActivity(user.id)
  }

  if (!user) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    avatarId: user.avatarId,
    avatarTone: user.avatarTone as EmblemToneId | null,
    lastSeenAt: user.lastSeenAt,
  }
}
