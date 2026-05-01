import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { routerMock, toastMock } from "../vitest.setup"

vi.mock("@/features/theme/ui/theme-toggle", () => ({ ThemeToggle: () => <div>ThemeToggle</div> }))
vi.mock("@/features/auth/ui/logout-button", () => ({ LogoutButton: () => <div>LogoutButton</div> }))
vi.mock("@/features/navigation/ui/bottom-nav", () => ({
  BottomNav: ({ active }: { active?: string }) => <div>BottomNav:{active ?? "none"}</div>,
}))
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
    const button = await screen.findByRole("button", { name: /Р’С‹Р№С‚Рё|Р вЂ™РЎвЂ№Р в„–РЎвЂљР С‘/ })
    fireEvent.click(button)

    await waitFor(() => expect(toastMock.success).toHaveBeenCalled())
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
    await user.type(screen.getByLabelText(/РџР°СЂРѕР»СЊ|Р СџР В°РЎР‚Р С•Р В»РЎРЉ/), "password123")
    await user.click(screen.getByRole("button", { name: /Р’РѕР№С‚Рё|Р вЂ™Р С•Р в„–РЎвЂљР С‘/ }))

    await waitFor(() => expect(toastMock.success).toHaveBeenCalled())
    expect(routerMock.replace).toHaveBeenCalledWith("/")

    await user.click(screen.getByRole("tab", { name: /Р РµРіРёСЃС‚СЂР°С†РёСЏ|Р В Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚Р В°РЎвЂ Р С‘РЎРЏ/ }))
    await user.type(screen.getByLabelText(/РРјСЏ|Р ВР СРЎРЏ/), "Ivan")
    await user.type(screen.getByLabelText(/Р¤Р°РјРёР»РёСЏ \(РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ\)|Р В¤Р В°Р СР С‘Р В»Р С‘РЎРЏ/), "Petrov")
    await user.type(screen.getByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText(/РўРµР»РµС„РѕРЅ|Р СћР ВµР В»Р ВµРЎвЂћР С•Р Р…/), "12345678")
    await user.click(screen.getByRole("button", { name: "Turnstile" }))
    await user.type(screen.getByLabelText(/РџР°СЂРѕР»СЊ|Р СџР В°РЎР‚Р С•Р В»РЎРЉ/), "password123")
    await user.type(screen.getByLabelText(/РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РїР°СЂРѕР»СЏ|Р СџР С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р С‘Р Вµ Р С—Р В°РЎР‚Р С•Р В»РЎРЏ/), "password123")
    await user.click(screen.getByRole("button", { name: /Р—Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°С‚СЊСЃСЏ|Р вЂ”Р В°РЎР‚Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉРЎРѓРЎРЏ/ }))

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
    await user.click(screen.getByRole("button", { name: /Р—Р°Р±С‹Р»Рё РїР°СЂРѕР»СЊ\?|Р вЂ”Р В°Р В±РЎвЂ№Р В»Р С‘ Р С—Р В°РЎР‚Р С•Р В»РЎРЉ\?/ }))
    expect(screen.getByText(/Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ РґРѕСЃС‚СѓРї\?|РЎР±СЂРѕСЃРёС‚СЊ Р°РєРєР°СѓРЅС‚\?/)).toBeInTheDocument()
    expect(
      screen.getByText(/РєРѕРЅС‚Р°РєС‚С‹, С‡С‘СЂРЅС‹Р№ СЃРїРёСЃРѕРє Рё РІСЃРµ С‡Р°С‚С‹ Р±СѓРґСѓС‚ РѕС‡РёС‰РµРЅС‹|Р С”Р С•Р Р…РЎвЂљР В°Р С”РЎвЂљРЎвЂ№, РЎвЂЎРЎвЂРЎР‚Р Р…РЎвЂ№Р в„– РЎРѓР С—Р С‘РЎРѓР С•Р С” Р С‘ Р Р†РЎРѓР Вµ РЎвЂЎР В°РЎвЂљРЎвЂ№ Р В±РЎС“Р Т‘РЎС“РЎвЂљ Р С•РЎвЂЎР С‘РЎвЂ°Р ВµР Р…РЎвЂ№/i)
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText(/РЈРєР°Р·Р°РЅРЅС‹Р№ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°|Р СњР С•Р СР ВµРЎР‚ РЎвЂљР ВµР В»Р ВµРЎвЂћР С•Р Р…Р В°/), "12345678")
    await user.click(screen.getByRole("button", { name: /РџСЂРѕРґРѕР»Р¶РёС‚СЊ|Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р С”Р С•Р Т‘/ }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/recover/request-code",
        expect.objectContaining({ method: "POST" })
      )
    )
    await user.type(screen.getByLabelText(/РљРѕРґ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ|Р С™Р С•Р Т‘ Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р С‘РЎРЏ/), "123456")
    await user.click(screen.getByRole("button", { name: /Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ|Р вЂќР В°/ }))

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/recover",
        expect.objectContaining({ method: "POST" })
      )
    )
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled())
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
    fireEvent.click(screen.getByRole("button", { name: /Р§Р°С‚С‹|Р В§Р В°РЎвЂљРЎвЂ№/ }))
    expect(routerMock.push).toHaveBeenCalledWith("/chats")

    const onChatsClick = vi.fn()
    rerender(<ActualBottomNav active="contacts" chatsBadgeCount={101} onChatsClick={onChatsClick} />)
    expect(screen.getByText("99+")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Р§Р°С‚С‹|Р В§Р В°РЎвЂљРЎвЂ№/ }))
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

    await user.clear(screen.getByLabelText(/РРјСЏ|Р ВР СРЎРЏ/))
    await user.type(screen.getByLabelText(/РРјСЏ|Р ВР СРЎРЏ/), "A")
    await user.click(screen.getByRole("button", { name: /РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС„РёР»СЊ|Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљРЎРЉ Р С—РЎР‚Р С•РЎвЂћР С‘Р В»РЎРЉ/ }))
    expect(await screen.findByText(/РРјСЏ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РЅРµ РєРѕСЂРѕС‡Рµ 2 СЃРёРјРІРѕР»РѕРІ|Р ВР СРЎРЏ Р Т‘Р С•Р В»Р В¶Р Р…Р С•/)).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/РРјСЏ|Р ВР СРЎРЏ/))
    await user.type(screen.getByLabelText(/РРјСЏ|Р ВР СРЎРЏ/), "Ivan")
    await user.clear(screen.getByLabelText("Email"))
    await user.type(screen.getByLabelText("Email"), "new@example.com")
    await user.click(screen.getByRole("button", { name: /РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС„РёР»СЊ|Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљРЎРЉ Р С—РЎР‚Р С•РЎвЂћР С‘Р В»РЎРЉ/ }))
    expect(await screen.findByText("bad")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС„РёР»СЊ|Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљРЎРЉ Р С—РЎР‚Р С•РЎвЂћР С‘Р В»РЎРЉ/ }))
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled())

    await user.type(screen.getByLabelText(/РўРµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ|Р СћР ВµР С”РЎС“РЎвЂ°Р С‘Р в„– Р С—Р В°РЎР‚Р С•Р В»РЎРЉ/), "password123")
    await user.type(screen.getByLabelText(/РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ|Р СњР С•Р Р†РЎвЂ№Р в„– Р С—Р В°РЎР‚Р С•Р В»РЎРЉ/), "newpassword123")
    await user.type(screen.getByLabelText(/РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РЅРѕРІРѕРіРѕ РїР°СЂРѕР»СЏ|Р СџР С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р С‘Р Вµ Р Р…Р С•Р Р†Р С•Р С–Р С• Р С—Р В°РЎР‚Р С•Р В»РЎРЏ/), "newpassword123")
    await user.click(screen.getByRole("button", { name: /РР·РјРµРЅРёС‚СЊ РїР°СЂРѕР»СЊ|Р ВР В·Р СР ВµР Р…Р С‘РЎвЂљРЎРЉ Р С—Р В°РЎР‚Р С•Р В»РЎРЉ/ }))
    expect(await screen.findByText("bad-password")).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/РўРµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ|Р СћР ВµР С”РЎС“РЎвЂ°Р С‘Р в„– Р С—Р В°РЎР‚Р С•Р В»РЎРЉ/))
    await user.type(screen.getByLabelText(/РўРµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ|Р СћР ВµР С”РЎС“РЎвЂ°Р С‘Р в„– Р С—Р В°РЎР‚Р С•Р В»РЎРЉ/), "password123")
    await user.clear(screen.getByLabelText(/РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ|Р СњР С•Р Р†РЎвЂ№Р в„– Р С—Р В°РЎР‚Р С•Р В»РЎРЉ/))
    await user.type(screen.getByLabelText(/РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ|Р СњР С•Р Р†РЎвЂ№Р в„– Р С—Р В°РЎР‚Р С•Р В»РЎРЉ/), "newpassword123")
    await user.clear(screen.getByLabelText(/РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РЅРѕРІРѕРіРѕ РїР°СЂРѕР»СЏ|Р СџР С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р С‘Р Вµ Р Р…Р С•Р Р†Р С•Р С–Р С• Р С—Р В°РЎР‚Р С•Р В»РЎРЏ/))
    await user.type(screen.getByLabelText(/РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РЅРѕРІРѕРіРѕ РїР°СЂРѕР»СЏ|Р СџР С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р С‘Р Вµ Р Р…Р С•Р Р†Р С•Р С–Р С• Р С—Р В°РЎР‚Р С•Р В»РЎРЏ/), "newpassword123")
    await user.click(screen.getByRole("button", { name: /РР·РјРµРЅРёС‚СЊ РїР°СЂРѕР»СЊ|Р ВР В·Р СР ВµР Р…Р С‘РЎвЂљРЎРЉ Р С—Р В°РЎР‚Р С•Р В»РЎРЉ/ }))
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled())

    await user.click(screen.getByRole("button", { name: /РЈРґР°Р»РёС‚СЊ Р°РєРєР°СѓРЅС‚|Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ Р В°Р С”Р С”Р В°РЎС“Р Р…РЎвЂљ/ }))
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled())
    expect(routerMock.replace).toHaveBeenCalledWith("/auth")
  })

  test("partner program copies personal referral link", async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(
      <ProfileHome
        user={{
          id: 42,
          email: "user@example.com",
          firstName: "Ivan",
          lastName: null,
          phone: "12345678",
          role: "user",
        }}
      />
    )

    expect(screen.getByText("https://shalter.ru/auth?ref=42")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "РЎРєРѕРїРёСЂРѕРІР°С‚СЊ СЃСЃС‹Р»РєСѓ" }))

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("https://shalter.ru/auth?ref=42")
    )
    expect(toastMock.success).toHaveBeenCalled()
  })
})

