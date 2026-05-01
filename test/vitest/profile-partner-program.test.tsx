import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"

import { toastMock } from "../vitest.setup"

vi.mock("@/features/theme/ui/theme-toggle", () => ({ ThemeToggle: () => <div>ThemeToggle</div> }))
vi.mock("@/features/auth/ui/logout-button", () => ({ LogoutButton: () => <div>LogoutButton</div> }))
vi.mock("@/features/navigation/ui/bottom-nav", () => ({
  BottomNav: ({ active }: { active?: string }) => <div>BottomNav:{active ?? "none"}</div>,
}))

import { ProfileHome } from "@/features/profile/ui/profile-home"

describe("profile partner program", () => {
  test("copies personal referral link from profile card", async () => {
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
    await user.click(screen.getByRole("button", { name: "Скопировать ссылку" }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://shalter.ru/auth?ref=42"))
    expect(toastMock.success).toHaveBeenCalled()
  })
})
