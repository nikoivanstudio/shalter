import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

const getCurrentUser = vi.fn()
const prisma = {
  contact: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  userBlacklist: { findMany: vi.fn() },
  dialog: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  message: { groupBy: vi.fn() },
}
const findUsersWhoBlockedActor = vi.fn()
const isUserOnline = vi.fn()
const canWriteToProtectedUser = vi.fn()

vi.mock("@/shared/lib/auth/current-user", () => ({ getCurrentUser }))
vi.mock("@/shared/lib/db/prisma", () => ({ prisma }))
vi.mock("@/shared/lib/blacklist", () => ({ findUsersWhoBlockedActor }))
vi.mock("@/shared/lib/direct-message-access", () => ({ canWriteToProtectedUser }))
vi.mock("@/shared/lib/user-activity", () => ({ isUserOnline }))
vi.mock("@/app/providers", () => ({ Providers: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock("@/app/pwa-register-client", () => ({ PwaRegisterClient: () => <div>PWA</div> }))
vi.mock("@/features/profile/ui/profile-home", () => ({ ProfileHome: ({ user }: any) => <div>{user.email}</div> }))
vi.mock("@/features/bots/ui/bots-home", () => ({ BotsHome: ({ user }: any) => <div>bots:{user.email}</div> }))
vi.mock("@/features/contacts/ui/contacts-home-client", () => ({ ContactsHomeClient: ({ contacts }: any) => <div>contacts:{contacts.length}</div> }))
vi.mock("@/features/contacts/ui/blacklist-home", () => ({ BlacklistHome: ({ blacklist }: any) => <div>blacklist:{blacklist.length}</div> }))
vi.mock("@/features/chats/ui/chats-home-client", () => ({ ChatsHomeClient: ({ dialogs, initialDialogId }: any) => <div>dialogs:{dialogs.length}:{initialDialogId ?? "none"}</div> }))
vi.mock("@/features/auth/ui/auth-card", () => ({ AuthCard: () => <div>AuthCard</div> }))
vi.mock("@/features/theme/ui/theme-toggle", () => ({ ThemeToggle: () => <div>ThemeToggle</div> }))

describe("app pages", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("auth page renders auth shell", async () => {
    const { default: AuthPage } = await import("@/app/auth/page")
    render(<AuthPage />)
    expect(screen.getByText("AuthCard")).toBeInTheDocument()
    expect(screen.getByText("ThemeToggle")).toBeInTheDocument()
    expect(screen.getByText("PWA")).toBeInTheDocument()
  })

  test("home page redirects anonymous users and renders profile for authorized ones", async () => {
    const { default: Home } = await import("@/app/page")

    getCurrentUser.mockResolvedValueOnce(null)
    await expect(Home()).rejects.toThrow("redirect:/auth")

    getCurrentUser.mockResolvedValueOnce({
      id: 1,
      email: "user@example.com",
      firstName: "Ivan",
      lastName: null,
      phone: "12345678",
    })
    render(await Home())
    expect(screen.getByText("user@example.com")).toBeInTheDocument()
  })

  test("bots page redirects anonymous users and renders constructor for authorized ones", async () => {
    const { default: BotsPage } = await import("@/app/bots/page")

    getCurrentUser.mockResolvedValueOnce(null)
    await expect(BotsPage()).rejects.toThrow("redirect:/auth")

    getCurrentUser.mockResolvedValueOnce({
      id: 1,
      email: "bot-owner@example.com",
      firstName: "Ivan",
      lastName: null,
      role: "user",
      avatarTone: null,
    })
    render(await BotsPage())
    expect(screen.getByText("bots:bot-owner@example.com")).toBeInTheDocument()
  })

  test("contacts and blacklist pages redirect anonymous users and map prisma payloads", async () => {
    const { default: ContactsPage } = await import("@/app/contacts/page")
    const { default: BlacklistPage } = await import("@/app/blacklist/page")

    getCurrentUser.mockResolvedValueOnce(null)
    await expect(ContactsPage()).rejects.toThrow("redirect:/auth")

    getCurrentUser.mockResolvedValueOnce({
      id: 1,
      email: "user@example.com",
      firstName: "Ivan",
      lastName: null,
    })
    prisma.contact.findMany.mockResolvedValueOnce([
      { contactUser: { id: 2, email: "a@example.com", firstName: "Anna", lastName: null, phone: "123" } },
    ])
    prisma.userBlacklist.findMany.mockResolvedValueOnce([
      { blockedUser: { id: 3, email: "b@example.com", firstName: "Bob", lastName: null, phone: "321" } },
    ])
    render(await ContactsPage())
    expect(screen.getByText("contacts:1")).toBeInTheDocument()

    getCurrentUser.mockResolvedValueOnce(null)
    await expect(BlacklistPage()).rejects.toThrow("redirect:/auth")

    getCurrentUser.mockResolvedValueOnce({
      id: 1,
      email: "user@example.com",
      firstName: "Ivan",
      lastName: null,
    })
    prisma.userBlacklist.findMany.mockResolvedValueOnce([
      { blockedUser: { id: 3, email: "b@example.com", firstName: "Bob", lastName: null, phone: "321" } },
    ])
    render(await BlacklistPage())
    expect(screen.getByText("blacklist:1")).toBeInTheDocument()
  })

  test("chats page redirects anonymous users and resolves dialogs", async () => {
    const { default: ChatsPage } = await import("@/app/chats/page")

    getCurrentUser.mockResolvedValueOnce(null)
    await expect(
      ChatsPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("redirect:/auth")

    getCurrentUser.mockResolvedValueOnce({
      id: 1,
      email: "user@example.com",
      firstName: "Ivan",
      lastName: null,
    })
    prisma.contact.findMany.mockResolvedValueOnce([
      { contactUser: { id: 2, firstName: "Anna", lastName: null, email: "a@example.com", phone: "123" } },
    ])
    prisma.dialog.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 11 })
    prisma.dialog.findMany.mockResolvedValueOnce([
      {
        id: 11,
        ownerId: 1,
        title: null,
        users: [{ id: 2, firstName: "Anna", lastName: null, email: "a@example.com", lastSeenAt: new Date("2026-04-14T10:00:00Z") }],
        Messages: [],
      },
    ])
    prisma.message.groupBy.mockResolvedValueOnce([{ dialogId: 11, _count: { _all: 2 } }])
    findUsersWhoBlockedActor.mockResolvedValueOnce([])
    canWriteToProtectedUser.mockResolvedValueOnce({ ok: true })
    prisma.dialog.create.mockResolvedValueOnce({ id: 11 })
    isUserOnline.mockReturnValue(true)

    render(await ChatsPage({ searchParams: Promise.resolve({ contactId: "2" }) }))
    expect(screen.getByText("dialogs:1:11")).toBeInTheDocument()

    getCurrentUser.mockResolvedValueOnce({
      id: 1,
      email: "user@example.com",
      firstName: "Ivan",
      lastName: null,
    })
    prisma.contact.findMany.mockResolvedValueOnce([])
    prisma.dialog.findFirst.mockResolvedValueOnce({ id: 12 })
    prisma.dialog.findMany.mockResolvedValueOnce([])
    prisma.message.groupBy.mockResolvedValueOnce([])
    render(await ChatsPage({ searchParams: Promise.resolve({ dialogId: "12" }) }))
    expect(screen.getByText("dialogs:0:11")).toBeInTheDocument()
  })
})
