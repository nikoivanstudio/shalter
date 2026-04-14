import { NextRequest } from "next/server"

jest.mock("@/shared/lib/auth/request-user", () => ({
  getAuthorizedUserIdFromRequest: jest.fn(),
}))
jest.mock("@/shared/lib/blacklist", () => ({
  findUsersWhoBlockedActor: jest.fn(),
  formatBlacklistUserName: jest.fn((user: { firstName: string; lastName: string | null }) =>
    `${user.firstName} ${user.lastName ?? ""}`.trim()
  ),
}))
jest.mock("@/shared/lib/db/prisma", () => ({
  prisma: {
    contact: { findMany: jest.fn() },
    dialog: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      groupBy: jest.fn(),
    },
    user: { findMany: jest.fn() },
    userBlacklist: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock("@/shared/lib/user-activity", () => ({
  isUserOnline: jest.fn(() => true),
  touchUserActivity: jest.fn(),
}))
jest.mock("@/shared/lib/notifications/push", () => ({
  sendPushToDialogRecipients: jest.fn(),
}))

const { getAuthorizedUserIdFromRequest } = jest.requireMock(
  "@/shared/lib/auth/request-user"
) as { getAuthorizedUserIdFromRequest: jest.Mock }
const { findUsersWhoBlockedActor } = jest.requireMock("@/shared/lib/blacklist") as {
  findUsersWhoBlockedActor: jest.Mock
}
const { prisma } = jest.requireMock("@/shared/lib/db/prisma") as {
  prisma: Record<string, any>
}
const { sendPushToDialogRecipients } = jest.requireMock(
  "@/shared/lib/notifications/push"
) as { sendPushToDialogRecipients: jest.Mock }

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

describe("chat routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("create chat route handles validation, existing dialogs and creation", async () => {
    const { POST } = await import("@/app/api/chats/route")

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(null)
    let response = await POST(nextRequest("http://localhost/api/chats", "POST", {}))
    expect(response.status).toBe(401)

    getAuthorizedUserIdFromRequest.mockResolvedValue(1)
    response = await POST(nextRequest("http://localhost/api/chats", "POST", {}))
    expect(response.status).toBe(400)

    response = await POST(
      nextRequest("http://localhost/api/chats", "POST", { participantIds: [1], title: "" })
    )
    expect(response.status).toBe(400)

    prisma.contact.findMany.mockResolvedValueOnce([])
    response = await POST(
      nextRequest("http://localhost/api/chats", "POST", { participantIds: [2], title: "" })
    )
    expect(response.status).toBe(400)

    prisma.contact.findMany.mockResolvedValueOnce([{ contactUserId: 2 }])
    findUsersWhoBlockedActor.mockResolvedValueOnce([{ owner: { firstName: "Anna", lastName: null } }])
    response = await POST(
      nextRequest("http://localhost/api/chats", "POST", { participantIds: [2], title: "" })
    )
    expect(response.status).toBe(403)

    prisma.contact.findMany.mockResolvedValueOnce([{ contactUserId: 2 }])
    findUsersWhoBlockedActor.mockResolvedValueOnce([])
    prisma.dialog.findFirst.mockResolvedValueOnce({ id: 9 })
    response = await POST(
      nextRequest("http://localhost/api/chats", "POST", { participantIds: [2], title: "" })
    )
    expect(await readJson(response)).toEqual({ existing: true, dialogId: 9 })

    prisma.contact.findMany.mockResolvedValueOnce([{ contactUserId: 2 }, { contactUserId: 3 }])
    findUsersWhoBlockedActor.mockResolvedValueOnce([])
    prisma.$transaction.mockResolvedValueOnce({
      id: 10,
      ownerId: 1,
      title: "Group",
      users: [{ id: 2, firstName: "Anna", lastName: null, email: "a@example.com", lastSeenAt: null }],
    })
    response = await POST(
      nextRequest("http://localhost/api/chats", "POST", { participantIds: [2, 3], title: "Group" })
    )
    expect(response.status).toBe(201)
  })

  test("dialog delete and leave routes handle access and state changes", async () => {
    const removeRoute = await import("@/app/api/chats/[dialogId]/route")
    const leaveRoute = await import("@/app/api/chats/[dialogId]/leave/route")

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(null)
    let response = await removeRoute.DELETE(nextRequest("http://localhost", "DELETE"), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(401)

    getAuthorizedUserIdFromRequest.mockResolvedValue(1)
    response = await removeRoute.DELETE(nextRequest("http://localhost", "DELETE"), {
      params: Promise.resolve({ dialogId: "bad" }),
    })
    expect(response.status).toBe(400)

    prisma.dialog.findFirst.mockResolvedValueOnce(null)
    response = await removeRoute.DELETE(nextRequest("http://localhost", "DELETE"), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(404)

    prisma.dialog.findFirst
      .mockResolvedValueOnce({ id: 1, ownerId: 2, users: [{ id: 1 }, { id: 2 }, { id: 3 }] })
      .mockResolvedValueOnce({ id: 1, ownerId: 1, users: [{ id: 1 }, { id: 2 }] })
    response = await removeRoute.DELETE(nextRequest("http://localhost", "DELETE"), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(403)

    prisma.$transaction.mockImplementationOnce(async (callback: any) =>
      callback({ message: { deleteMany: jest.fn() }, dialog: { deleteMany: jest.fn() } })
    )
    response = await removeRoute.DELETE(nextRequest("http://localhost", "DELETE"), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(200)

    getAuthorizedUserIdFromRequest.mockResolvedValueOnce(null)
    response = await leaveRoute.POST(nextRequest("http://localhost", "POST"), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(401)

    getAuthorizedUserIdFromRequest.mockResolvedValue(1)
    prisma.dialog.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 1, ownerId: 1, users: [{ id: 1, firstName: "Ivan", lastName: null }, { id: 2, firstName: "Anna", lastName: null }] })
      .mockResolvedValueOnce({ id: 1, ownerId: 1, users: [{ id: 1, firstName: "Ivan", lastName: null }, { id: 2, firstName: "Anna", lastName: null }, { id: 3, firstName: "Bob", lastName: null }] })
    response = await leaveRoute.POST(nextRequest("http://localhost", "POST"), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(404)
    response = await leaveRoute.POST(nextRequest("http://localhost", "POST"), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(400)
    prisma.$transaction.mockImplementationOnce(async (callback: any) =>
      callback({ message: { create: jest.fn() }, dialog: { update: jest.fn() } })
    )
    response = await leaveRoute.POST(nextRequest("http://localhost", "POST"), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(200)
  })

  test("messages routes cover load, send, read, update and delete", async () => {
    const messagesRoute = await import("@/app/api/chats/[dialogId]/messages/route")
    const readRoute = await import("@/app/api/chats/[dialogId]/messages/read/route")
    const messageRoute = await import("@/app/api/chats/[dialogId]/messages/[messageId]/route")

    getAuthorizedUserIdFromRequest.mockResolvedValue(1)
    prisma.dialog.findFirst.mockResolvedValueOnce(null)
    prisma.dialog.findUnique.mockResolvedValueOnce({ id: 1 })
    let response = await messagesRoute.GET(nextRequest("http://localhost", "GET"), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(404)

    prisma.dialog.findFirst.mockResolvedValueOnce({ id: 1 })
    prisma.message.findMany.mockResolvedValueOnce([
      {
        id: 5,
        content: "Hello",
        status: "DELIVERED",
        createdAt: new Date(),
        dialogId: 1,
        author: { id: 2, firstName: "Anna", lastName: null },
      },
    ])
    response = await messagesRoute.GET(nextRequest("http://localhost", "GET"), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(200)

    prisma.dialog.findFirst.mockResolvedValueOnce({ id: 1 })
    response = await messagesRoute.POST(nextRequest("http://localhost", "POST", {}), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(400)

    prisma.dialog.findFirst.mockResolvedValueOnce({ id: 1 })
    prisma.userBlacklist.findMany.mockResolvedValueOnce([{ owner: { firstName: "Anna", lastName: null } }])
    response = await messagesRoute.POST(nextRequest("http://localhost", "POST", { content: "hello" }), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(403)

    prisma.dialog.findFirst.mockResolvedValueOnce({ id: 1 })
    prisma.userBlacklist.findMany.mockResolvedValueOnce([])
    prisma.message.create.mockResolvedValueOnce({
      id: 6,
      content: "hello",
      status: "SENT",
      createdAt: new Date(),
      dialogId: 1,
      author: { id: 1, firstName: "Ivan", lastName: null },
    })
    response = await messagesRoute.POST(nextRequest("http://localhost", "POST", { content: "hello" }), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(201)
    expect(sendPushToDialogRecipients).toHaveBeenCalled()

    prisma.dialog.findFirst.mockResolvedValueOnce({ id: 1 })
    prisma.message.findMany.mockResolvedValueOnce([{ id: 10 }, { id: 11 }])
    response = await readRoute.POST(nextRequest("http://localhost", "POST"), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(await readJson(response)).toEqual({ readMessageIds: [10, 11] })

    prisma.dialog.findFirst.mockResolvedValueOnce({ id: 1 })
    prisma.message.findFirst
      .mockResolvedValueOnce({ id: 5, authorId: 2 })
      .mockResolvedValueOnce({ id: 5, authorId: 1 })
      .mockResolvedValueOnce({ id: 5, authorId: 1 })
      .mockResolvedValueOnce({ id: 5, authorId: 2 })
      .mockResolvedValueOnce({ id: 5, authorId: 1 })
    response = await messageRoute.PATCH(nextRequest("http://localhost", "PATCH", { content: "hello" }), {
      params: Promise.resolve({ dialogId: "1", messageId: "5" }),
    })
    expect(response.status).toBe(403)

    prisma.dialog.findFirst.mockResolvedValueOnce({ id: 1 })
    prisma.userBlacklist.findMany.mockResolvedValueOnce([{ owner: { firstName: "Anna", lastName: null } }])
    response = await messageRoute.PATCH(nextRequest("http://localhost", "PATCH", { content: "hello" }), {
      params: Promise.resolve({ dialogId: "1", messageId: "5" }),
    })
    expect(response.status).toBe(403)

    prisma.dialog.findFirst.mockResolvedValueOnce({ id: 1 })
    prisma.userBlacklist.findMany.mockResolvedValueOnce([])
    prisma.message.update.mockResolvedValueOnce({
      id: 5,
      content: "hello",
      status: "READ",
      createdAt: new Date(),
      dialogId: 1,
      author: { id: 1, firstName: "Ivan", lastName: null },
    })
    response = await messageRoute.PATCH(nextRequest("http://localhost", "PATCH", { content: "hello" }), {
      params: Promise.resolve({ dialogId: "1", messageId: "5" }),
    })
    expect(response.status).toBe(200)

    response = await messageRoute.DELETE(nextRequest("http://localhost", "DELETE"), {
      params: Promise.resolve({ dialogId: "1", messageId: "bad" }),
    })
    expect(response.status).toBe(400)

    prisma.dialog.findFirst.mockResolvedValueOnce({ id: 1 })
    response = await messageRoute.DELETE(nextRequest("http://localhost", "DELETE"), {
      params: Promise.resolve({ dialogId: "1", messageId: "5" }),
    })
    expect(response.status).toBe(403)

    prisma.dialog.findFirst.mockResolvedValueOnce({ id: 1 })
    prisma.message.findFirst.mockResolvedValueOnce({ id: 5, authorId: 1 })
    response = await messageRoute.DELETE(nextRequest("http://localhost", "DELETE"), {
      params: Promise.resolve({ dialogId: "1", messageId: "5" }),
    })
    expect(response.status).toBe(200)
  })

  test("participants and unread routes handle group management and snapshots", async () => {
    const participantsRoute = await import("@/app/api/chats/[dialogId]/participants/route")
    const unreadRoute = await import("@/app/api/chats/unread/route")

    getAuthorizedUserIdFromRequest.mockResolvedValue(1)
    prisma.dialog.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 1, ownerId: 2, title: "Group", users: [{ id: 1, firstName: "Ivan", lastName: null, email: "u@example.com" }] })
      .mockResolvedValueOnce({ id: 1, ownerId: 1, title: null, users: [{ id: 1, firstName: "Ivan", lastName: null, email: "u@example.com" }, { id: 2, firstName: "Anna", lastName: null, email: "a@example.com" }] })
      .mockResolvedValueOnce({ id: 1, ownerId: 1, title: "Group", users: [{ id: 1, firstName: "Ivan", lastName: null, email: "u@example.com" }, { id: 2, firstName: "Anna", lastName: null, email: "a@example.com" }] })
    let response = await participantsRoute.POST(nextRequest("http://localhost", "POST", { participantIds: [2] }), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(404)
    response = await participantsRoute.POST(nextRequest("http://localhost", "POST", { participantIds: [2] }), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(403)
    response = await participantsRoute.POST(nextRequest("http://localhost", "POST", { participantIds: [3] }), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(400)

    prisma.contact.findMany.mockResolvedValueOnce([{ contactUserId: 3 }])
    findUsersWhoBlockedActor.mockResolvedValueOnce([])
    prisma.user.findMany.mockResolvedValueOnce([{ id: 3, firstName: "Bob", lastName: null, email: "b@example.com", lastSeenAt: null }])
    prisma.$transaction.mockResolvedValueOnce({
      id: 10,
      content: "Bob добавлен в чат",
      status: null,
      createdAt: new Date(),
      dialogId: 1,
      author: { id: 1, firstName: "Ivan", lastName: null },
    })
    response = await participantsRoute.POST(nextRequest("http://localhost", "POST", { participantIds: [3] }), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(200)

    prisma.dialog.findFirst
      .mockResolvedValueOnce({ id: 1, ownerId: 1, title: "Group", users: [{ id: 1, firstName: "Ivan", lastName: null, email: "u@example.com" }, { id: 2, firstName: "Anna", lastName: null, email: "a@example.com" }] })
      .mockResolvedValueOnce({ id: 1, ownerId: 1, title: "Group", users: [{ id: 1, firstName: "Ivan", lastName: null, email: "u@example.com" }, { id: 2, firstName: "Anna", lastName: null, email: "a@example.com" }, { id: 3, firstName: "Bob", lastName: null, email: "b@example.com" }] })
    response = await participantsRoute.DELETE(nextRequest("http://localhost", "DELETE", { targetUserId: 1 }), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(400)

    prisma.$transaction.mockResolvedValueOnce({
      id: 11,
      content: "Bob удалён из чата",
      status: null,
      createdAt: new Date(),
      dialogId: 1,
      author: { id: 1, firstName: "Ivan", lastName: null },
    })
    response = await participantsRoute.DELETE(nextRequest("http://localhost", "DELETE", { targetUserId: 3 }), {
      params: Promise.resolve({ dialogId: "1" }),
    })
    expect(response.status).toBe(200)

    prisma.message.groupBy.mockResolvedValueOnce([{ dialogId: 1, _count: { _all: 3 } }])
    prisma.dialog.findMany.mockResolvedValueOnce([{ users: [{ id: 1, lastSeenAt: null }] }])
    response = await unreadRoute.GET(nextRequest("http://localhost", "GET"))
    expect(response.status).toBe(200)
  })
})
