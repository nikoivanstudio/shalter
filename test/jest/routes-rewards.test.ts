import { NextRequest } from "next/server"

jest.mock("@/shared/lib/auth/request-user", () => ({
  getAuthorizedUserIdFromRequest: jest.fn(),
}))
jest.mock("@/shared/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    starTransaction: {
      create: jest.fn(),
    },
    giftTransaction: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

const { getAuthorizedUserIdFromRequest } = jest.requireMock(
  "@/shared/lib/auth/request-user"
) as { getAuthorizedUserIdFromRequest: jest.Mock }
const { prisma } = jest.requireMock("@/shared/lib/db/prisma") as {
  prisma: Record<string, any>
}

function nextRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("rewards routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("stars route enforces admin gifting and succeeds", async () => {
    const { POST } = await import("@/app/api/rewards/stars/route")

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(null)
    let response = await POST(nextRequest("http://localhost/api/rewards/stars", {}))
    expect(response.status).toBe(401)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    response = await POST(nextRequest("http://localhost/api/rewards/stars", { amount: 20 }))
    expect(response.status).toBe(400)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    prisma.user.findUnique.mockResolvedValueOnce({ id: 1, role: "user", starsBalance: 50 })
    response = await POST(
      nextRequest("http://localhost/api/rewards/stars", {
        recipientEmail: "user@example.com",
        amount: 20,
      })
    )
    expect(response.status).toBe(403)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 1, role: "admin", starsBalance: 0 })
      .mockResolvedValueOnce({
        id: 2,
        email: "user@example.com",
        firstName: "Ivan",
        isBlocked: false,
        starsBalance: 10,
      })
    prisma.$transaction.mockImplementationOnce(async (callback: any) =>
      callback({
        user: { update: jest.fn() },
        starTransaction: { create: jest.fn() },
      })
    )
    response = await POST(
      nextRequest("http://localhost/api/rewards/stars", {
        recipientEmail: "user@example.com",
        amount: 20,
      })
    )
    expect(response.status).toBe(200)
  })

  test("gifts route allows purchase and gifting", async () => {
    const { POST } = await import("@/app/api/rewards/gifts/route")

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(5)
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 5, role: "user", starsBalance: 100 })
      .mockResolvedValueOnce({
        id: 9,
        email: "friend@example.com",
        firstName: "Anna",
        isBlocked: false,
      })
    prisma.$transaction.mockImplementationOnce(async (callback: any) =>
      callback({
        user: { update: jest.fn() },
        giftTransaction: { create: jest.fn() },
      })
    )

    const response = await POST(
      nextRequest("http://localhost/api/rewards/gifts", {
        recipientEmail: "friend@example.com",
        giftKey: "coffee",
      })
    )
    expect(response.status).toBe(200)
  })
})
