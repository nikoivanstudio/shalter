import { NextRequest } from "next/server"

jest.mock("@/shared/lib/auth/request-user", () => ({
  getAuthorizedUserIdFromRequest: jest.fn(),
}))
jest.mock("@/shared/lib/db/prisma", () => ({
  prisma: {
    botPublication: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

const { getAuthorizedUserIdFromRequest } = jest.requireMock(
  "@/shared/lib/auth/request-user"
) as { getAuthorizedUserIdFromRequest: jest.Mock }
const { prisma } = jest.requireMock("@/shared/lib/db/prisma") as {
  prisma: Record<string, any>
}

function nextRequest(url: string, method: "POST" | "DELETE", body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
  })
}

describe("bots routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("publish route handles auth, validation and success", async () => {
    const { POST } = await import("@/app/api/bots/route")

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(null)
    let response = await POST(nextRequest("http://localhost/api/bots", "POST", {}))
    expect(response.status).toBe(401)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(7)
    response = await POST(nextRequest("http://localhost/api/bots", "POST", {}))
    expect(response.status).toBe(400)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(7)
    prisma.botPublication.create.mockResolvedValueOnce({
      id: 3,
      name: "Sales Copilot",
      niche: "E-commerce",
      audience: "client",
      publishedAt: new Date("2026-05-01T09:00:00Z"),
    })
    response = await POST(
      nextRequest("http://localhost/api/bots", "POST", {
        audience: "client",
        config: {
          name: "Sales Copilot",
          niche: "E-commerce",
          goal: "Qualify leads",
          tone: "Helpful",
          greeting: "Hello there",
          knowledge: ["Pricing"],
          channels: ["Shalter"],
          skills: ["Lead capture"],
          guardrails: ["No fake promises"],
          escalation: "Send complex requests to a human",
          flow: [{ type: "identity", title: "Start", value: "Sales Copilot|E-commerce" }],
          handoffEnabled: true,
          analytics: {
            trackLeads: true,
            trackFallbacks: true,
            summaryWindow: "daily",
          },
        },
      })
    )
    expect(response.status).toBe(201)
    expect(prisma.botPublication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: 7,
        name: "Sales Copilot",
        audience: "client",
      }),
    })
  })

  test("delete route handles auth, id validation, access and success", async () => {
    const { DELETE } = await import("@/app/api/bots/[botId]/route")

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(null)
    let response = await DELETE(
      nextRequest("http://localhost/api/bots/1", "DELETE"),
      { params: Promise.resolve({ botId: "1" }) } as RouteContext<"/api/bots/[botId]">
    )
    expect(response.status).toBe(401)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(7)
    response = await DELETE(
      nextRequest("http://localhost/api/bots/abc", "DELETE"),
      { params: Promise.resolve({ botId: "abc" }) } as RouteContext<"/api/bots/[botId]">
    )
    expect(response.status).toBe(400)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(7)
    prisma.botPublication.findUnique.mockResolvedValueOnce(null)
    response = await DELETE(
      nextRequest("http://localhost/api/bots/2", "DELETE"),
      { params: Promise.resolve({ botId: "2" }) } as RouteContext<"/api/bots/[botId]">
    )
    expect(response.status).toBe(404)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(7)
    prisma.botPublication.findUnique.mockResolvedValueOnce({ id: 2, ownerId: 9 })
    response = await DELETE(
      nextRequest("http://localhost/api/bots/2", "DELETE"),
      { params: Promise.resolve({ botId: "2" }) } as RouteContext<"/api/bots/[botId]">
    )
    expect(response.status).toBe(403)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(7)
    prisma.botPublication.findUnique.mockResolvedValueOnce({ id: 2, ownerId: 7 })
    prisma.botPublication.delete.mockResolvedValueOnce({ id: 2 })
    response = await DELETE(
      nextRequest("http://localhost/api/bots/2", "DELETE"),
      { params: Promise.resolve({ botId: "2" }) } as RouteContext<"/api/bots/[botId]">
    )
    expect(response.status).toBe(200)
    expect(prisma.botPublication.delete).toHaveBeenCalledWith({ where: { id: 2 } })
  })
})
