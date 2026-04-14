import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { routerMock, toastMock } from "../vitest.setup"

vi.mock("@/features/theme/ui/theme-toggle", () => ({ ThemeToggle: () => <div>ThemeToggle</div> }))
vi.mock("@/features/auth/ui/logout-button", () => ({ LogoutButton: () => <div>LogoutButton</div> }))
vi.mock("@/features/navigation/ui/bottom-nav", () => ({ BottomNav: ({ active }: { active?: string }) => <div>BottomNav:{active}</div> }))

import { BlacklistHome } from "@/features/contacts/ui/blacklist-home"
import { ContactsHome } from "@/features/contacts/ui/contacts-home"
import { PushToggle } from "@/features/notifications/ui/push-toggle"

describe("contacts, blacklist and push components", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", vi.fn())
  })

  test("contacts home searches, adds/removes contacts and blacklist entries", async () => {
    const user = userEvent.setup()
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: [
            {
              id: 4,
              firstName: "Bob",
              lastName: null,
              phone: "555",
              email: "b@example.com",
              isAlreadyContact: false,
              isBlacklisted: false,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contact: {
            id: 4,
            firstName: "Bob",
            lastName: null,
            phone: "555",
            email: "b@example.com",
          },
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ blockedUser: { id: 2, firstName: "Anna", lastName: null, phone: "123", email: "a@example.com" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })

    render(
      <ContactsHome
        user={{ id: 1, email: "user@example.com", firstName: "Ivan", lastName: null }}
        contacts={[{ id: 2, email: "a@example.com", firstName: "Anna", lastName: null, phone: "123" }]}
        blacklist={[]}
      />
    )

    fireEvent.change(screen.getByPlaceholderText("Введите имя или телефон"), {
      target: { value: "Bob" },
    })
    expect(await screen.findByText("Bob")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Добавить" }))
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Контакт добавлен"))

    await user.click(screen.getAllByLabelText("Действия с контактом")[0])
    await user.click(screen.getByText("Добавить в ЧС"))
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Пользователь добавлен в чёрный список"))

    await user.click(screen.getAllByLabelText("Действия с контактом")[0])
    await user.click(screen.getByText("Удалить контакт"))
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Контакт удалён"))

    fireEvent.click(screen.getByText("Открыть чёрный список"))
    expect(routerMock.push).toHaveBeenCalledWith("/blacklist")
  })

  test("blacklist home toggles add form, searches and removes users", async () => {
    const user = userEvent.setup()
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: [
            {
              id: 5,
              firstName: "Petr",
              lastName: null,
              phone: "555",
              email: "p@example.com",
              isAlreadyContact: false,
              isBlacklisted: false,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          blockedUser: {
            id: 5,
            firstName: "Petr",
            lastName: null,
            phone: "555",
            email: "p@example.com",
          },
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })

    render(
      <BlacklistHome
        user={{ id: 1, email: "user@example.com", firstName: "Ivan", lastName: null }}
        blacklist={[{ id: 2, email: "a@example.com", firstName: "Anna", lastName: null, phone: "123" }]}
      />
    )

    await user.click(screen.getByLabelText("Добавить в чёрный список"))
    fireEvent.change(screen.getByPlaceholderText("Введите имя или телефон"), {
      target: { value: "Petr" },
    })
    expect(await screen.findByText("Petr")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "В ЧС" }))
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Пользователь добавлен в чёрный список"))

    await user.click(screen.getAllByRole("button", { name: "Убрать" })[0])
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Пользователь удалён из чёрного списка"))

    fireEvent.click(screen.getByText("К контактам"))
    expect(routerMock.push).toHaveBeenCalledWith("/contacts")
  })

  test("push toggle subscribes and unsubscribes via service worker", async () => {
    const user = userEvent.setup()
    const requestPermission = vi.fn().mockResolvedValue("granted")
    const unsubscribe = vi.fn().mockResolvedValue(true)
    const subscription = {
      endpoint: "endpoint",
      unsubscribe,
      toJSON: () => ({ endpoint: "endpoint", keys: { p256dh: "a", auth: "b" } }),
    }
    const subscribe = vi.fn().mockResolvedValue(subscription)
    const getSubscription = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(subscription)
    const ready = Promise.resolve({
      pushManager: {
        getSubscription,
        subscribe,
      },
    })

    Object.defineProperty(global.navigator, "serviceWorker", {
      configurable: true,
      value: { ready },
    })
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManager() {},
    })
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "default",
        requestPermission,
      },
    })
    window.atob = vi.fn().mockReturnValue("abcd")
    ;(fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ publicKey: "abcd" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })

    render(<PushToggle />)
    const button = await screen.findByRole("button", { name: "Включить push-уведомления" })
    await user.click(button)
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Уведомления включены"))

    const enabledButton = await screen.findByRole("button", { name: "Отключить push-уведомления" })
    await user.click(enabledButton)
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Уведомления отключены"))
  })
})
