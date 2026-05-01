import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"

import { routerMock, toastMock } from "../vitest.setup"

vi.mock("@/features/theme/ui/theme-toggle", () => ({ ThemeToggle: () => <div>ThemeToggle</div> }))
vi.mock("@/features/auth/ui/logout-button", () => ({ LogoutButton: () => <div>LogoutButton</div> }))

import { BotsHome } from "@/features/bots/ui/bots-home"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"

describe("bots builder", () => {
  test("bottom nav opens bots route", async () => {
    const close = vi.fn()
    class MockEventSource {
      addEventListener = vi.fn((event: string, handler: (payload: MessageEvent) => void) => {
        if (event === "unread") {
          handler({ data: JSON.stringify({ dialogsWithUnread: 1 }) } as MessageEvent)
        }
      })
      close = close
      constructor(url: string) {
        void url
      }
    }

    vi.stubGlobal("EventSource", MockEventSource as any)

    render(<BottomNav active="bots" />)
    fireEvent.click(screen.getByRole("button", { name: /Боты|Р‘РѕС‚С‹/ }))
    expect(routerMock.push).toHaveBeenCalledWith("/bots")
  })

  test("constructor updates preview and copies generated config", async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(
      <BotsHome
        user={{
          id: 1,
          email: "owner@example.com",
          firstName: "Ivan",
          lastName: "Petrov",
          role: "user",
          avatarTone: null,
        }}
      />
    )

    await user.clear(screen.getByLabelText(/Имя бота|РРјСЏ Р±РѕС‚Р°/))
    await user.type(screen.getByLabelText(/Имя бота|РРјСЏ Р±РѕС‚Р°/), "Sales Copilot")
    expect(screen.getAllByText("Sales Copilot").length).toBeGreaterThan(0)

    await user.click(screen.getByRole("button", { name: "Навык" }))
    expect(screen.getAllByText("Навык").length).toBeGreaterThan(0)

    await user.click(screen.getByRole("button", { name: /Скопировать конфиг|РЎРєРѕРїРёСЂРѕРІР°С‚СЊ РєРѕРЅС„РёРі/ }))
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(toastMock.success).toHaveBeenCalled()
  })
})
