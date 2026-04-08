"use client"

import { BellIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function PushToggle() {
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)

  useEffect(() => {
    const isSupported = "serviceWorker" in navigator && "PushManager" in window
    setSupported(isSupported)

    if (!isSupported) {
      return
    }

    void fetch("/api/notifications/vapid-public-key")
      .then(async (response) => {
        if (!response.ok) {
          return null
        }
        return (await response.json()) as { publicKey: string }
      })
      .then((data) => {
        if (!data?.publicKey) {
          return
        }
        setPublicKey(data.publicKey)
      })
      .catch(() => null)

    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setEnabled(Boolean(subscription))
      })
      .catch(() => null)
  }, [])

  async function subscribe() {
    if (!publicKey) {
      toast.error("Push уведомления не настроены на сервере")
      return
    }

    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }

      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.message ?? "Не удалось включить уведомления")
      }

      setEnabled(true)
      toast.success("Уведомления включены")
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await fetch("/api/notifications/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }

      setEnabled(false)
      toast.success("Уведомления отключены")
    } catch {
      toast.error("Не удалось отключить уведомления")
    } finally {
      setLoading(false)
    }
  }

  if (!supported) {
    return null
  }

  return (
    <Button
      variant={enabled ? "secondary" : "outline"}
      disabled={loading}
      onClick={() => (enabled ? void unsubscribe() : void subscribe())}
    >
      <BellIcon className="size-4" />
      {enabled ? "Уведомления вкл" : "Включить push"}
    </Button>
  )
}
