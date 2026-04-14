var mockSetVapidDetails = jest.fn()
var mockSendNotification = jest.fn()

var mockPrisma = {
  pushSubscription: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
}

jest.mock("web-push", () => ({
  __esModule: true,
  default: {
    setVapidDetails: mockSetVapidDetails,
    sendNotification: mockSendNotification,
  },
}))
jest.mock("@/shared/lib/db/prisma", () => ({ prisma: mockPrisma }))

describe("push helpers", () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public"
    process.env.VAPID_PRIVATE_KEY = "private"
    process.env.VAPID_SUBJECT = "admin@example.com"
  })

  test("push config helpers expose configuration state", async () => {
    const push = await import("@/shared/lib/notifications/push")
    expect(push.getPublicVapidKey()).toBe("public")
    expect(push.isPushConfigured()).toBe(true)
    expect(push.getPushConfigurationError()).toBeNull()

    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    jest.resetModules()
    const missing = await import("@/shared/lib/notifications/push")
    expect(missing.isPushConfigured()).toBe(false)
    expect(missing.getPushConfigurationError()).toContain("NEXT_PUBLIC_VAPID_PUBLIC_KEY")
  })

  test("save/remove subscriptions validate payloads", async () => {
    const push = await import("@/shared/lib/notifications/push")

    await expect(
      push.savePushSubscription(1, {
        endpoint: "",
      })
    ).rejects.toThrow("Invalid push subscription")

    await push.savePushSubscription(1, {
      endpoint: "endpoint",
      expirationTime: 123,
      keys: {
        p256dh: "p256dh",
        auth: "auth",
      },
    })

    expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalled()

    await push.removePushSubscription(1, "endpoint")
    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 1,
        endpoint: "endpoint",
      },
    })
  })

  test("sendPushToDialogRecipients skips, sends and cleans invalid subscriptions", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        endpoint: "endpoint-1",
        p256dh: "key-1",
        auth: "auth-1",
      },
      {
        endpoint: "endpoint-2",
        p256dh: "key-2",
        auth: "auth-2",
      },
    ])
    mockSendNotification
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ statusCode: 410 })

    const push = await import("@/shared/lib/notifications/push")

    await push.sendPushToDialogRecipients({
      dialogId: 1,
      authorId: 5,
      authorName: "Ivan",
      content: "Hello",
    })

    await push.sendPushToDialogRecipients({
      dialogId: 1,
      authorId: 5,
      authorName: "Ivan",
      content: "Hello",
    })

    expect(mockSetVapidDetails).toHaveBeenCalledWith("mailto:admin@example.com", "public", "private")
    expect(mockSendNotification).toHaveBeenCalledTimes(2)
    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: "endpoint-2" },
    })
  })
})
