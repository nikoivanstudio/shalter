import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { routerMock, toastMock } from "../vitest.setup"

vi.mock("@/features/theme/ui/theme-toggle", () => ({ ThemeToggle: () => <div>ThemeToggle</div> }))
vi.mock("@/features/auth/ui/logout-button", () => ({ LogoutButton: () => <div>LogoutButton</div> }))
vi.mock("@/features/navigation/ui/bottom-nav", () => ({ BottomNav: ({ active }: { active?: string }) => <div>BottomNav:{active ?? "none"}</div> }))
vi.mock("@/features/auth/ui/turnstile-widget", () => ({
  TurnstileWidget: ({ onTokenChange }: { onTokenChange: (token: string) => void }) => (
    <button type="button" onClick={() => onTokenChange("turnstile-token")}>
      Turnstile
    </button>
  ),
}))

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
    const button = await screen.findByRole("button", { name: /Выйти|Р’С‹Р№С‚Рё|Р’С‹С…РѕРґРёРј/ })
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
        json: async () => ({ message: "РћС€РёР±РєР° СЂРµРіРёСЃС‚СЂР°С†РёРё", fieldErrors: { email: ["duplicate"] } }),
      })

    render(<AuthCard />)
    await user.type(screen.getByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText(/Пароль|РџР°СЂРѕР»СЊ/), "password123")
    await user.click(screen.getByRole("button", { name: /Войти|Р’РѕР№С‚Рё/ }))

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Вход выполнен"))
    expect(routerMock.replace).toHaveBeenCalledWith("/")

    await user.click(screen.getByText(/Регистрация|Р РµРіРёСЃС‚СЂР°С†РёСЏ/))
    await user.type(screen.getByLabelText(/Имя|РРјСЏ/), "Ivan")
    await user.type(screen.getByLabelText(/Фамилия \(необязательно\)|Р¤Р°РјРёР»РёСЏ \(РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ\)/), "Petrov")
    await user.type(screen.getByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText(/Телефон|РўРµР»РµС„РѕРЅ/), "12345678")
    await user.click(screen.getByRole("button", { name: "Turnstile" }))
    await user.type(screen.getByLabelText(/Пароль|РџР°СЂРѕР»СЊ/), "password123")
    await user.type(screen.getByLabelText(/Подтверждение пароля|РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РїР°СЂРѕР»СЏ/), "password123")
    await user.click(screen.getByRole("button", { name: /Зарегистрироваться|Р—Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°С‚СЊСЃСЏ/ }))

    await screen.findByText("РћС€РёР±РєР° СЂРµРіРёСЃС‚СЂР°С†РёРё")
    expect(screen.getByText("duplicate")).toBeInTheDocument()
  })

  test("auth card opens recovery confirmation and recovers account", async () => {
    const user = userEvent.setup()
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: 1 } }),
      })

    render(<AuthCard />)
    await user.click(screen.getByRole("button", { name: /Забыли пароль\?|Р—Р°Р±С‹Р»Рё РїР°СЂРѕР»СЊ\?/ }))
    expect(screen.getByText(/Сбросить аккаунт\?|РЎР±СЂРѕСЃРёС‚СЊ Р°РєРєР°СѓРЅС‚\?/)).toBeInTheDocument()
    expect(
      screen.getByText(/контакты, чёрный список и все чаты будут очищены|РєРѕРЅС‚Р°РєС‚С‹, С‡С‘СЂРЅС‹Р№ СЃРїРёСЃРѕРє Рё РІСЃРµ С‡Р°С‚С‹ Р±СѓРґСѓС‚ РѕС‡РёС‰РµРЅС‹/i)
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Номер телефона для восстановления|РќРѕРјРµСЂ С‚РµР»РµС„РѕРЅР° РґР»СЏ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ/), "12345678")
    await user.click(screen.getByRole("button", { name: /Отправить код|РћС‚РїСЂР°РІРёС‚СЊ РєРѕРґ/ }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/auth/recover/request-code",
      expect.objectContaining({ method: "POST" })
    ))
    await user.type(screen.getByLabelText(/Код подтверждения|РљРѕРґ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ/), "123456")
    await user.click(screen.getByRole("button", { name: /Да|Р”Р°/ }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/auth/recover",
      expect.objectContaining({ method: "POST" })
    ))
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Аккаунт восстановлен"))
    expect(routerMock.replace).toHaveBeenCalledWith("/")
    expect(routerMock.refresh).toHaveBeenCalled()
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
      constructor(url: string) {
        void url
      }
    }
    vi.stubGlobal("EventSource", MockEventSource as any)

    const { rerender } = render(<ActualBottomNav />)
    expect(await screen.findByText("3")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Р§Р°С‚С‹|Чаты/ }))
    expect(routerMock.push).toHaveBeenCalledWith("/chats")

    const onChatsClick = vi.fn()
    rerender(
      <ActualBottomNav active="contacts" chatsBadgeCount={101} onChatsClick={onChatsClick} />
    )
    expect(screen.getByText("99+")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Р§Р°С‚С‹|Чаты/ }))
    expect(onChatsClick).toHaveBeenCalled()
  })

  test("profile home validates save and delete flows", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true))
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС„РёР»СЊ", fieldErrors: { email: ["bad"] } }),
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
        ok: false,
        json: async () => ({
          message: "РўРµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ РІРІРµРґС‘РЅ РЅРµРІРµСЂРЅРѕ",
          fieldErrors: { currentPassword: ["bad-password"] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
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
          role: "user",
        }}
      />
    )

    await user.clear(screen.getByLabelText(/Имя|РРјСЏ/))
    await user.type(screen.getByLabelText(/Имя|РРјСЏ/), "A")
    await user.click(screen.getByRole("button", { name: /Сохранить профиль|РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС„РёР»СЊ/ }))
    expect(await screen.findByText(/Имя должно быть не короче 2 символов|РРјСЏ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РЅРµ РєРѕСЂРѕС‡Рµ 2 СЃРёРјРІРѕР»РѕРІ/)).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/Имя|РРјСЏ/))
    await user.type(screen.getByLabelText(/Имя|РРјСЏ/), "Ivan")
    await user.clear(screen.getByLabelText("Email"))
    await user.type(screen.getByLabelText("Email"), "new@example.com")
    await user.click(screen.getByRole("button", { name: /Сохранить профиль|РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС„РёР»СЊ/ }))
    expect(await screen.findByText("bad")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Сохранить профиль|РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС„РёР»СЊ/ }))
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Профиль сохранён"))

    await user.type(screen.getByLabelText(/Текущий пароль|РўРµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ/), "password123")
    await user.type(screen.getByLabelText(/Новый пароль|РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ/), "newpassword123")
    await user.type(screen.getByLabelText(/Подтверждение нового пароля|РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РЅРѕРІРѕРіРѕ РїР°СЂРѕР»СЏ/), "newpassword123")
    await user.click(screen.getByRole("button", { name: /Изменить пароль|РР·РјРµРЅРёС‚СЊ РїР°СЂРѕР»СЊ/ }))
    expect(await screen.findByText("bad-password")).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/Текущий пароль|РўРµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ/))
    await user.type(screen.getByLabelText(/Текущий пароль|РўРµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ/), "password123")
    await user.clear(screen.getByLabelText(/Новый пароль|РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ/))
    await user.type(screen.getByLabelText(/Новый пароль|РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ/), "newpassword123")
    await user.clear(screen.getByLabelText(/Подтверждение нового пароля|РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РЅРѕРІРѕРіРѕ РїР°СЂРѕР»СЏ/))
    await user.type(screen.getByLabelText(/Подтверждение нового пароля|РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РЅРѕРІРѕРіРѕ РїР°СЂРѕР»СЏ/), "newpassword123")
    await user.click(screen.getByRole("button", { name: /Изменить пароль|РР·РјРµРЅРёС‚СЊ РїР°СЂРѕР»СЊ/ }))
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Пароль изменён"))

    await user.click(screen.getByRole("button", { name: /Удалить аккаунт|РЈРґР°Р»РёС‚СЊ Р°РєРєР°СѓРЅС‚/ }))
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Аккаунт удалён"))
    expect(routerMock.replace).toHaveBeenCalledWith("/auth")
  })
})
