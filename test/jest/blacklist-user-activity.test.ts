jest.mock("@/shared/lib/db/prisma", () => ({
  prisma: {
    userBlacklist: {
      findMany: jest.fn(),
    },
    user: {
      updateMany: jest.fn(),
    },
  },
}))

import {
  findUsersWhoBlockedActor,
  formatBlacklistUserName,
  getBlacklistIds,
} from "@/shared/lib/blacklist"
import { isUserOnline, touchUserActivity } from "@/shared/lib/user-activity"

const { prisma: mockPrisma } = jest.requireMock("@/shared/lib/db/prisma") as {
  prisma: {
    userBlacklist: { findMany: jest.Mock }
    user: { updateMany: jest.Mock }
  }
}

describe("blacklist and user activity", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("blacklist helpers use prisma and format names", async () => {
    mockPrisma.userBlacklist.findMany
      .mockResolvedValueOnce([{ blockedUserId: 2 }, { blockedUserId: 4 }])
      .mockResolvedValueOnce([{ ownerId: 9, owner: { id: 9, firstName: "Oleg", lastName: null } }])

    await expect(getBlacklistIds(1)).resolves.toEqual(new Set([2, 4]))
    await expect(findUsersWhoBlockedActor(5, [9])).resolves.toEqual([
      { ownerId: 9, owner: { id: 9, firstName: "Oleg", lastName: null } },
    ])
    await expect(findUsersWhoBlockedActor(5, [])).resolves.toEqual([])
    expect(formatBlacklistUserName({ firstName: "Oleg", lastName: null })).toBe("Oleg")
  })

  test("isUserOnline and touchUserActivity update activity conditionally", async () => {
    const now = new Date("2026-04-14T10:00:00.000Z")
    jest.useFakeTimers().setSystemTime(now)

    expect(isUserOnline(new Date("2026-04-14T09:55:01.000Z"))).toBe(true)
    expect(isUserOnline(new Date("2026-04-14T09:49:59.000Z"))).toBe(false)
    expect(isUserOnline(null)).toBe(false)

    await touchUserActivity(5)
    await touchUserActivity(5, true)

    expect(mockPrisma.user.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ id: 5 }),
      })
    )
    expect(mockPrisma.user.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 5 },
      })
    )

    jest.useRealTimers()
  })
})
