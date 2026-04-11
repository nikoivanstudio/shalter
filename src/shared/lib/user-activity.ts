import { prisma } from "@/shared/lib/db/prisma"

export const USER_ONLINE_WINDOW_MS = 10 * 60 * 1000
const USER_ACTIVITY_TOUCH_INTERVAL_MS = 60 * 1000

export function isUserOnline(lastSeenAt: Date | null | undefined) {
  if (!lastSeenAt) {
    return false
  }

  return Date.now() - lastSeenAt.getTime() <= USER_ONLINE_WINDOW_MS
}

export async function touchUserActivity(userId: number, force = false) {
  const now = new Date()
  const threshold = new Date(now.getTime() - USER_ACTIVITY_TOUCH_INTERVAL_MS)

  await prisma.user.updateMany({
    where: force
      ? { id: userId }
      : {
          id: userId,
          OR: [
            { lastSeenAt: null },
            { lastSeenAt: { lt: threshold } },
          ],
        },
    data: {
      lastSeenAt: now,
    },
  })
}
