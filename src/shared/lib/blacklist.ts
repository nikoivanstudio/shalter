import { prisma } from "@/shared/lib/db/prisma"

export async function getBlacklistIds(ownerId: number) {
  const rows = await prisma.userBlacklist.findMany({
    where: { ownerId },
    select: { blockedUserId: true },
  })

  return new Set(rows.map((item) => item.blockedUserId))
}

export async function findUsersWhoBlockedActor(actorId: number, targetUserIds: number[]) {
  if (targetUserIds.length === 0) {
    return []
  }

  return prisma.userBlacklist.findMany({
    where: {
      ownerId: { in: targetUserIds },
      blockedUserId: actorId,
    },
    select: {
      ownerId: true,
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })
}

export function formatBlacklistUserName(user: { firstName: string; lastName: string | null }) {
  return `${user.firstName} ${user.lastName ?? ""}`.trim()
}
