"use client"

import { useEffect, useRef } from "react"

import { getTurnstileSiteKey } from "@/shared/lib/turnstile"

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          callback?: (token: string) => void
          "expired-callback"?: () => void
          "error-callback"?: () => void
          theme?: "light" | "dark" | "auto"
        }
      ) => string
      remove?: (widgetId: string) => void
      reset?: (widgetId?: string) => void
    }
  }
}

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script"
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

function loadTurnstileScript() {
  const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null

  if (existingScript) {
    if (window.turnstile) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(), { once: true })
      existingScript.addEventListener("error", () => reject(new Error("Turnstile load error")), {
        once: true,
      })
    })
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.id = TURNSTILE_SCRIPT_ID
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.addEventListener("load", () => resolve(), { once: true })
    script.addEventListener("error", () => reject(new Error("Turnstile load error")), {
      once: true,
    })
    document.head.appendChild(script)
  })
}

export function TurnstileWidget({
  onTokenChange,
  resetKey,
}: {
  onTokenChange: (token: string | null) => void
  resetKey: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const siteKey = getTurnstileSiteKey()

  useEffect(() => {
    let cancelled = false

    onTokenChange(null)

    if (!siteKey) {
      return
    }

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current) {
          return
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "auto",
          callback: (token) => {
            onTokenChange(token)
          },
          "expired-callback": () => {
            onTokenChange(null)
          },
          "error-callback": () => {
            onTokenChange(null)
          },
        })
      })
      .catch(() => {
        onTokenChange(null)
      })

    return () => {
      cancelled = true

      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current)
      }
    }
  }, [onTokenChange, siteKey])

  useEffect(() => {
    if (resetKey > 0 && widgetIdRef.current && window.turnstile?.reset) {
      window.turnstile.reset(widgetIdRef.current)
      onTokenChange(null)
    }
  }, [onTokenChange, resetKey])

  if (!siteKey) {
    return (
      <p className="text-sm text-destructive">
        Turnstile не настроен. Укажите `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
      </p>
    )
  }

  return <div ref={containerRef} className="min-h-16" />
}
