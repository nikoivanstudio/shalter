import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { routerMock, toastMock } from "../vitest.setup"

vi.mock("@/features/theme/ui/theme-toggle", () => ({ ThemeToggle: () => <div>ThemeToggle</div> }))
vi.mock("@/features/auth/ui/logout-button", () => ({ LogoutButton: () => <div>LogoutButton</div> }))
vi.mock("@/features/navigation/ui/bottom-nav", () => ({ BottomNav: ({ active }: { active?: string }) => <div>BottomNav:{active ?? "none"}</div> }))

import { AuthCard } from "@/features/auth/ui/auth-card"
import { ProfileHome } from "@/features/profile/ui/profile-home"

describe("auth/profile/navigation components", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", vi.fn())
  })

  test("logout button loads and triggers logout flow", async () => {
    const mod = await vi.importActual<typeof import("@/features/auth/ui/logout-button")>(
      "@/features/auth/ui/logout-button"
    )
    ;(fetch as any).mockResolvedValueOnce({ ok: true })

    render(<mod.LogoutButton />)
    const button = await screen.findByRole("button", { name: /Выйти|Выходим/ })
    fireEvent.click(button)

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Вы вышли из аккаунта"))
    expect(routerMock.replace).toHaveBeenCalledWith("/auth")
    expect(routerMock.refresh).toHaveBeenCalled()
  })

  test("auth card validates, submits login and register flows", async () => {
    const user = userEvent.setup()
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Ошибка регистрации", fieldErrors: { email: ["duplicate"] } }),
      })

    render(<AuthCard />)
    await user.type(screen.getByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText("Пароль"), "password123")
    await user.click(screen.getByRole("button", { name: "Войти" }))

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Вход выполнен"))
    expect(routerMock.replace).toHaveBeenCalledWith("/")

    await user.click(screen.getByText("Регистрация"))
    await user.type(screen.getByLabelText("Имя"), "Ivan")
    await user.type(screen.getByLabelText("Фамилия"), "Petrov")
    await user.type(screen.getByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText("Телефон"), "12345678")
    await user.type(screen.getByLabelText("Приглашение"), "invite-code")
    await user.type(screen.getByLabelText("Пароль"), "password123")
    await user.type(screen.getByLabelText("Подтверждение пароля"), "password123")
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }))

    await screen.findByText("Ошибка регистрации")
    expect(screen.getByText("duplicate")).toBeInTheDocument()
  })

  test("bottom nav handles external badge and event source badge", async () => {
    const { BottomNav: ActualBottomNav } = await vi.importActual<
      typeof import("@/features/navigation/ui/bottom-nav")
    >("@/features/navigation/ui/bottom-nav")
    const close = vi.fn()
    class MockEventSource {
      addEventListener = vi.fn((event: string, handler: (payload: MessageEvent) => void) => {
        if (event === "unread") {
          handler({ data: JSON.stringify({ dialogsWithUnread: 3 }) } as MessageEvent)
        }
      })
      close = close
      constructor(_url: string) {}
    }
    vi.stubGlobal("EventSource", MockEventSource as any)

    const { rerender } = render(<ActualBottomNav />)
    expect(await screen.findByText("3")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Чаты"))
    expect(routerMock.push).toHaveBeenCalledWith("/chats")

    const onChatsClick = vi.fn()
    rerender(
      <ActualBottomNav active="contacts" chatsBadgeCount={101} onChatsClick={onChatsClick} />
    )
    expect(screen.getByText("99+")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Чаты"))
    expect(onChatsClick).toHaveBeenCalled()
  })

  test("profile home validates save and delete flows", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true))
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Не удалось сохранить профиль", fieldErrors: { email: ["bad"] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            email: "new@example.com",
            firstName: "New",
            lastName: "Name",
            phone: "99999999",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })

    render(
      <ProfileHome
        user={{
          id: 1,
          email: "user@example.com",
          firstName: "Ivan",
          lastName: null,
          phone: "12345678",
        }}
      />
    )

    await user.clear(screen.getByLabelText("Имя"))
    await user.type(screen.getByLabelText("Имя"), "A")
    await user.click(screen.getByRole("button", { name: "Сохранить профиль" }))
    expect(await screen.findByText("Имя должно быть не короче 2 символов")).toBeInTheDocument()

    await user.clear(screen.getByLabelText("Имя"))
    await user.type(screen.getByLabelText("Имя"), "Ivan")
    await user.clear(screen.getByLabelText("Email"))
    await user.type(screen.getByLabelText("Email"), "new@example.com")
    await user.click(screen.getByRole("button", { name: "Сохранить профиль" }))
    expect(await screen.findByText("bad")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Сохранить профиль" }))
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Профиль сохранён"))

    await user.click(screen.getByRole("button", { name: "Удалить аккаунт" }))
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Аккаунт удалён"))
    expect(routerMock.replace).toHaveBeenCalledWith("/auth")
  })
})
