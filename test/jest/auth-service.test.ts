var MockPrismaClientKnownRequestError = class PrismaClientKnownRequestError extends Error {
  code: string
  meta?: { target?: string[] }

  constructor(code: string, meta?: { target?: string[] }) {
    super(code)
    this.code = code
    this.meta = meta
  }
}

jest.mock("@/shared/lib/db/prisma", () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))
jest.mock("bcryptjs", () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
    compare: jest.fn(),
  },
}))
jest.mock("@prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
  },
}))

async function loadAuthService() {
  jest.resetModules()
  const module = await import("@/features/auth/api/auth-service")
  const { prisma } = jest.requireMock("@/shared/lib/db/prisma") as {
    prisma: {
      user: {
        findFirst: jest.Mock
        create: jest.Mock
        findUnique: jest.Mock
      }
    }
  }
  const bcrypt = jest.requireMock("bcryptjs").default as {
    hash: jest.Mock
    compare: jest.Mock
  }

  return {
    ...module,
    mockPrisma: prisma,
    bcrypt,
  }
}

describe("auth-service", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("registerUser rejects invalid invite and duplicates", async () => {
    const { registerUser, mockPrisma } = await loadAuthService()

    mockPrisma.user.findFirst.mockResolvedValueOnce({
      email: "user@example.com",
      phone: "12345678",
    })

    await expect(
      registerUser({
        email: "USER@example.com",
        password: "password123",
        firstName: "Ivan",
        phone: "12345678",
      })
    ).resolves.toMatchObject({
      ok: false,
      status: 409,
      fieldErrors: {
        email: ["Пользователь с таким email уже существует"],
        phone: ["Пользователь с таким телефоном уже существует"],
      },
    })
  })

  test("registerUser creates user and handles unique constraint", async () => {
    const { registerUser, mockPrisma, bcrypt } = await loadAuthService()

    mockPrisma.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    bcrypt.hash.mockResolvedValue("hash")
    mockPrisma.user.create
      .mockResolvedValueOnce({ id: 1, email: "user@example.com" })
      .mockRejectedValueOnce(new MockPrismaClientKnownRequestError("P2002", { target: ["email"] }))

    await expect(
      registerUser({
        email: "USER@example.com",
        password: "password123",
        firstName: "Ivan",
        lastName: "Petrov",
        phone: "12345678",
      })
    ).resolves.toEqual({
      ok: true,
      user: { id: 1, email: "user@example.com" },
    })

    await expect(
      registerUser({
        email: "other@example.com",
        password: "password123",
        firstName: "Ivan",
        phone: "12345679",
      })
    ).resolves.toMatchObject({
      ok: false,
      status: 409,
      fieldErrors: {
        email: ["Пользователь с таким email уже существует"],
      },
    })
  })

  test("loginUser validates missing user, wrong password and success", async () => {
    const { loginUser, mockPrisma, bcrypt } = await loadAuthService()

    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 1, email: "user@example.com", passwordHash: "hash" })
      .mockResolvedValueOnce({ id: 1, email: "user@example.com", passwordHash: "hash" })
    bcrypt.compare.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    await expect(loginUser({ email: "USER@example.com", password: "password123" })).resolves.toEqual({
      ok: false,
      status: 401,
      message: "Неверный email или пароль",
    })
    await expect(loginUser({ email: "USER@example.com", password: "password123" })).resolves.toEqual({
      ok: false,
      status: 401,
      message: "Неверный email или пароль",
    })
    await expect(loginUser({ email: "USER@example.com", password: "password123" })).resolves.toEqual({
      ok: true,
      user: { id: 1, email: "user@example.com" },
    })
  })
})
