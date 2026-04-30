var mockJwtVerify = jest.fn()

class MockSignJWT {
  payload: Record<string, unknown>

  constructor(payload: Record<string, unknown>) {
    this.payload = payload
  }

  setProtectedHeader() {
    return this
  }

  setIssuedAt() {
    return this
  }

  setExpirationTime() {
    return this
  }

  async sign() {
    return JSON.stringify(this.payload)
  }
}

jest.mock("jose", () => ({
  SignJWT: MockSignJWT,
  jwtVerify: mockJwtVerify,
}))

describe("env and session", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  test("env exports required values", async () => {
    process.env.AUTH_SECRET = "secret"

    const { env } = await import("@/shared/config/env")
    expect(env).toEqual({
      AUTH_SECRET: "secret",
      BOOTSTRAP_ADMIN_EMAIL: null,
    })
  })

  test("env throws when values are missing", async () => {
    delete process.env.AUTH_SECRET

    await expect(import("@/shared/config/env")).rejects.toThrow("AUTH_SECRET is not set")
  })

  test("session utilities sign, verify and manage cookies", async () => {
    process.env.AUTH_SECRET = "secret"
    process.env.INVITE_MESSAGE = "invite"
    const { NextResponse } = await import("next/server")
    const session = await import("@/shared/lib/auth/session")

    jest.spyOn(global.crypto, "randomUUID").mockReturnValue("session-id")

    expect(session.createSessionId()).toBe("session-id")

    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        userId: 7,
        email: "user@example.com",
        sid: "session-id",
      },
    })
    mockJwtVerify.mockRejectedValueOnce(new Error("bad token"))

    const token = await session.createAuthToken({
      userId: 7,
      email: "user@example.com",
      sid: "session-id",
    })

    await expect(session.verifyAuthToken(token)).resolves.toMatchObject({
      userId: 7,
      email: "user@example.com",
      sid: "session-id",
    })
    await expect(session.verifyAuthToken("bad-token")).resolves.toBeNull()

    const response = NextResponse.json({ ok: true })
    session.setAuthCookies(response, { token, sessionId: "session-id" })

    expect(response.cookies.get(session.AUTH_TOKEN_COOKIE)?.value).toBe(token)
    expect(response.cookies.get(session.AUTH_SESSION_COOKIE)?.value).toBe("session-id")

    session.clearAuthCookies(response)
    expect(response.cookies.get(session.AUTH_TOKEN_COOKIE)?.value).toBe("")
    expect(response.cookies.get(session.AUTH_SESSION_COOKIE)?.value).toBe("")
  })
})
