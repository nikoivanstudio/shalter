"use client"

import { useEffect } from "react"

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return
    }

    if (process.env.NODE_ENV !== "production") {
      const CLEANUP_FLAG = "__shalter_sw_cleanup_done__"

      void (async () => {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))

        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))

        const hasController = Boolean(navigator.serviceWorker.controller)
        if (hasController && !sessionStorage.getItem(CLEANUP_FLAG)) {
          sessionStorage.setItem(CLEANUP_FLAG, "1")
          window.location.reload()
          return
        }

        sessionStorage.removeItem(CLEANUP_FLAG)
      })()

      return
    }

    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    })

    const onMessage = (event: MessageEvent<{ type?: string; url?: string }>) => {
      if (event.data?.type !== "open-url" || !event.data.url) {
        return
      }
      window.location.assign(event.data.url)
    }

    navigator.serviceWorker.addEventListener("message", onMessage)
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage)
    }
  }, [])

  return null
}
