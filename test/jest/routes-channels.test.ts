import { NextRequest } from "next/server"

jest.mock("@/shared/lib/auth/request-user", () => ({
  getAuthorizedUserIdFromRequest: jest.fn(),
}))
jest.mock("@/shared/lib/db/prisma", () => ({
  prisma: {
    channel: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    channelParticipant: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    channelMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    contact: {
      findMany: jest.fn(),
    },
  },
}))

const { getAuthorizedUserIdFromRequest } = jest.requireMock(
  "@/shared/lib/auth/request-user"
) as { getAuthorizedUserIdFromRequest: jest.Mock }
const { prisma } = jest.requireMock("@/shared/lib/db/prisma") as {
  prisma: Record<string, any>
}

function nextRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
  })
}

async function readJson(response: Response) {
  return response.json()
}

describe("channel routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("create, search and join routes work", async () => {
    const createRoute = await import("@/app/api/channels/route")
    const searchRoute = await import("@/app/api/channels/search/route")
    const joinRoute = await import("@/app/api/channels/[channelId]/join/route")

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(null)
    let response: Response = await createRoute.POST(nextRequest("http://localhost/api/channels", "POST", {}))
    expect(response.status).toBe(401)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    response = await createRoute.POST(nextRequest("http://localhost/api/channels", "POST", {}))
    expect(response.status).toBe(400)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    prisma.channel.create.mockResolvedValueOnce({
      id: 1,
      title: "News",
      description: "desc",
      avatarUrl: null,
      ownerId: 1,
      lastMessage: null,
      participants: [
        {
          role: "OWNER",
          user: {
            id: 1,
            firstName: "Ivan",
            lastName: null,
            email: "u@example.com",
            phone: "123",
            role: "user",
            avatarTone: null,
            avatarUrl: null,
            isBlocked: false,
          },
        },
      ],
    })
    response = await createRoute.POST(
      nextRequest("http://localhost/api/channels", "POST", { title: "News", description: "desc" })
    )
    expect(response.status).toBe(201)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    response = await searchRoute.GET(new NextRequest("http://localhost/api/channels/search?q="))
    expect(await readJson(response)).toEqual({ channels: [] })

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    prisma.channel.findMany.mockResolvedValueOnce([
      {
        id: 1,
        title: "News",
        description: "desc",
        avatarUrl: null,
        ownerId: 1,
        _count: { participants: 2 },
        participants: [{ role: "OWNER" }],
      },
    ])
    response = await searchRoute.GET(new NextRequest("http://localhost/api/channels/search?q=new"))
    expect(response.status).toBe(200)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    prisma.channel.findUnique.mockResolvedValueOnce({ id: 1 })
    response = await joinRoute.POST(nextRequest("http://localhost", "POST"), {
      params: Promise.resolve({ channelId: "1" }),
    })
    expect(response.status).toBe(200)
    expect(prisma.channelParticipant.upsert).toHaveBeenCalled()
  })

  test("messages and participants routes enforce roles", async () => {
    const messagesRoute = await import("@/app/api/channels/[channelId]/messages/route")
    const participantsRoute = await import("@/app/api/channels/[channelId]/participants/route")
    const channelRoute = await import("@/app/api/channels/[channelId]/route")

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    prisma.channelParticipant.findFirst.mockResolvedValueOnce(null)
    let response: Response = await messagesRoute.GET(nextRequest("http://localhost", "GET"), {
      params: Promise.resolve({ channelId: "1" }),
    })
    expect(response.status).toBe(404)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    prisma.channelParticipant.findFirst.mockResolvedValueOnce({ role: "MEMBER" })
    response = await messagesRoute.POST(
      nextRequest("http://localhost", "POST", { content: "hello" }),
      {
        params: Promise.resolve({ channelId: "1" }),
      }
    )
    expect(response.status).toBe(403)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    prisma.channelParticipant.findFirst.mockResolvedValueOnce({ role: "ADMIN" })
    prisma.channelMessage.create.mockResolvedValueOnce({
      id: 5,
      channelId: 1,
      content: "hello",
      createdAt: new Date().toISOString(),
      author: {
        id: 1,
        firstName: "Ivan",
        lastName: null,
        avatarTone: null,
        avatarUrl: null,
      },
      attachment: null,
    })
    response = await messagesRoute.POST(
      nextRequest("http://localhost", "POST", { content: "hello" }),
      {
        params: Promise.resolve({ channelId: "1" }),
      }
    )
    expect(response.status).toBe(201)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    prisma.channel.findFirst.mockResolvedValueOnce({
      id: 1,
      ownerId: 1,
      participants: [{ userId: 1 }, { userId: 2 }],
    })
    response = await participantsRoute.POST(
      nextRequest("http://localhost", "POST", { participantIds: [2] }),
      {
        params: Promise.resolve({ channelId: "1" }),
      }
    )
    expect(response.status).toBe(400)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    prisma.channel.findFirst.mockResolvedValueOnce({
      id: 1,
      ownerId: 1,
      participants: [{ userId: 1, role: "OWNER", user: { id: 1 } }],
    })
    prisma.contact.findMany.mockResolvedValueOnce([{ contactUserId: 2 }])
    prisma.channelParticipant.findMany.mockResolvedValueOnce([
      {
        role: "MEMBER",
        user: {
          id: 2,
          firstName: "Anna",
          lastName: null,
          email: "a@example.com",
          phone: "321",
          role: "user",
          avatarTone: null,
          avatarUrl: null,
          isBlocked: false,
        },
      },
    ])
    response = await participantsRoute.POST(
      nextRequest("http://localhost", "POST", { participantIds: [2] }),
      {
        params: Promise.resolve({ channelId: "1" }),
      }
    )
    expect(response.status).toBe(200)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    prisma.channel.findFirst.mockResolvedValueOnce({
      id: 1,
      ownerId: 1,
      participants: [
        { userId: 1, role: "OWNER", user: { id: 1 } },
        { userId: 2, role: "MEMBER", user: { id: 2 } },
      ],
    })
    prisma.channelParticipant.update.mockResolvedValueOnce({
      role: "ADMIN",
      user: {
        id: 2,
        firstName: "Anna",
        lastName: null,
        email: "a@example.com",
        phone: "321",
        role: "user",
        avatarTone: null,
        avatarUrl: null,
        isBlocked: false,
      },
    })
    response = await participantsRoute.PATCH(
      nextRequest("http://localhost", "PATCH", { targetUserId: 2, role: "ADMIN" }),
      {
        params: Promise.resolve({ channelId: "1" }),
      }
    )
    expect(response.status).toBe(200)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    prisma.channel.findFirst.mockResolvedValueOnce({
      id: 1,
      ownerId: 1,
      participants: [
        { userId: 1, role: "OWNER", user: { id: 1 } },
        { userId: 2, role: "MEMBER", user: { id: 2 } },
      ],
    })
    response = await participantsRoute.DELETE(new NextRequest("http://localhost?targetUserId=2", { method: "DELETE" }), {
      params: Promise.resolve({ channelId: "1" }),
    })
    expect(response.status).toBe(200)
    expect(prisma.channelParticipant.delete).toHaveBeenCalled()

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(1)
    prisma.channel.findFirst.mockResolvedValueOnce({
      id: 1,
      ownerId: 1,
      avatarUrl: null,
    })
    response = await channelRoute.DELETE(nextRequest("http://localhost", "DELETE"), {
      params: Promise.resolve({ channelId: "1" }),
    })
    expect(response.status).toBe(200)
    expect(prisma.channel.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
