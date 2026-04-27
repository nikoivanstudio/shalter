import "@testing-library/jest-dom/vitest"

import React, { useEffect, useState } from "react"
import { afterEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "test-auth-secret"
process.env.INVITE_MESSAGE = process.env.INVITE_MESSAGE ?? "invite-code"
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://test:test@localhost:5432/test"
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "test-public-key"
process.env.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "test-private-key"
process.env.VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "admin@example.com"
process.env.SMTP_HOST = process.env.SMTP_HOST ?? "smtp.example.com"
process.env.SMTP_PORT = process.env.SMTP_PORT ?? "587"
process.env.SMTP_SECURE = process.env.SMTP_SECURE ?? "false"
process.env.SMTP_USER = process.env.SMTP_USER ?? "smtp-user"
process.env.SMTP_PASS = process.env.SMTP_PASS ?? "smtp-pass"
process.env.SMTP_FROM = process.env.SMTP_FROM ?? "robot@example.com"

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: query.includes("prefers-color-scheme: dark"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: vi.fn(),
})

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn(),
})

Object.defineProperty(window, "requestAnimationFrame", {
  writable: true,
  value: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0),
})

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}

export const redirectMock = vi.fn((url: string) => {
  throw new Error(`redirect:${url}`)
})

export const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
}

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => routerMock,
}))

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-geist" }),
  Geist_Mono: () => ({ variable: "font-geist-mono" }),
}))

vi.mock("next/dynamic", () => ({
  default: (
    loader: () => Promise<any>,
    options?: { loading?: (props: Record<string, unknown>) => React.ReactNode }
  ) => {
    return function DynamicComponent(props: Record<string, unknown>) {
      const [Loaded, setLoaded] = useState<React.ComponentType<any> | null>(null)

      useEffect(() => {
        let active = true
        void Promise.resolve(loader()).then((module) => {
          const resolved = module.default ?? module
          if (active) {
            setLoaded(() => resolved)
          }
        })

        return () => {
          active = false
        }
      }, [])

      if (!Loaded) {
        return options?.loading
          ? React.createElement(React.Fragment, null, options.loading(props))
          : null
      }

      return React.createElement(Loaded, props)
    }
  },
}))

vi.mock("sonner", () => ({
  Toaster: () => React.createElement("div", { "data-testid": "toaster" }),
  toast: toastMock,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
