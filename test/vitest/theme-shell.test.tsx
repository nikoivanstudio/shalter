import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { ReactElement } from "react"
import { describe, expect, test, vi } from "vitest"

import { Providers } from "@/app/providers"
import { PwaRegister } from "@/app/pwa-register"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import GlobalError, { dynamic as globalErrorDynamic } from "@/app/global-error"
import RootLayout, { metadata } from "@/app/layout"
import manifest from "@/app/manifest"
import NotFound, { dynamic as notFoundDynamic } from "@/app/not-found"
import { ThemeProvider, useTheme } from "@/features/theme/model/theme-provider"
import { ThemeToggle } from "@/features/theme/ui/theme-toggle"

function ThemeConsumer() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <div>
      <span>{theme}</span>
      <span>{resolvedTheme}</span>
      <button onClick={() => setTheme("dark")}>Set Dark</button>
    </div>
  )
}

describe("theme and shell", () => {
  test("theme provider exposes state and toggle updates it", async () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
        <ThemeToggle />
      </ThemeProvider>
    )

    expect(screen.getByText("system")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Set Dark"))
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true))

    fireEvent.click(screen.getByLabelText("Переключить тему"))
    expect(await screen.findByText("Светлая")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Тёмная"))
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true))
  })

  test("providers and app shell components render", async () => {
    const register = vi.fn()
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    Object.defineProperty(global.navigator, "serviceWorker", {
      configurable: true,
      value: {
        register,
        addEventListener,
        removeEventListener,
      },
    })

    render(
      <Providers>
        <div>Child</div>
      </Providers>
    )

    expect(screen.getByText("Child")).toBeInTheDocument()
    expect(await screen.findByTestId("toaster")).toBeInTheDocument()

    const assign = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign },
    })

    render(<PwaRegister />)
    await waitFor(() => expect(register).toHaveBeenCalled())
    const messageHandler = addEventListener.mock.calls[0][1]
    messageHandler({ data: { type: "open-url", url: "/chats" } })
    expect(assign).toHaveBeenCalledWith("/chats")

    render(<PwaRegisterClient />)
    expect(document.body).toBeInTheDocument()
  })

  test("layout, manifest and error pages render expected metadata", () => {
    const layout = RootLayout({ children: <div>Body</div> }) as ReactElement
    expect(layout.type).toBe("html")
    expect(layout.props.className).toContain("font-geist")
    expect((layout.props.children as ReactElement).props.className).toContain("flex")
    expect(metadata.title).toBe("Shalter")
    expect(manifest().display).toBe("fullscreen")
    expect(manifest().icons).toHaveLength(3)
    expect(globalErrorDynamic).toBe("force-dynamic")
    expect(notFoundDynamic).toBe("force-dynamic")
    render(<GlobalError error={new Error("Boom")} reset={vi.fn()} />)
    render(<NotFound />)
    expect(screen.getByText(/Boom/)).toBeInTheDocument()
  })
})
