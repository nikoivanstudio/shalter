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
  starsBalance: number
  partnerStarsEarned: number
  avatarId: number | null
  avatarTone: EmblemToneId | null
  avatarUrl: string | null
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

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: number
      email: string
      first_name: string
      last_name: string | null
      phone: string
      role: string
      stars_balance: number
      partner_stars_earned: number
      avatar_id: number | null
      avatar_tone: string | null
      avatar_url: string | null
      is_blocked: boolean
      last_seen_at: Date | null
    }>
  >(
    `
      select
        id,
        email,
        first_name,
        last_name,
        phone,
        role,
        stars_balance,
        partner_stars_earned,
        avatar_id,
        avatar_tone,
        avatar_url,
        is_blocked,
        last_seen_at
      from users
      where id = $1
      limit 1
    `,
    payload.userId
  )
  const user = rows[0]

  if (user?.is_blocked) {
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
    firstName: user.first_name,
    lastName: user.last_name,
    phone: user.phone,
    role: user.role,
    starsBalance: user.stars_balance,
    partnerStarsEarned: user.partner_stars_earned,
    avatarId: user.avatar_id,
    avatarTone: user.avatar_tone as EmblemToneId | null,
    avatarUrl: user.avatar_url,
    lastSeenAt: user.last_seen_at,
  }
}
