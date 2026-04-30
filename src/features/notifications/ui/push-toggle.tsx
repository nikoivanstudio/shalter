"use client"

import { BellIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/features/i18n/model/i18n-provider"

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
  const { tr } = useI18n()
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null
  )
  const [isCheckingConfig, setIsCheckingConfig] = useState(!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)

  const fetchPublicKey = useCallback(async () => {
    const response = await fetch("/api/notifications/vapid-public-key")
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(tr(data?.message ?? "Push уведомления не настроены на сервере"))
    }

    const data = (await response.json()) as { publicKey?: string }
    if (!data.publicKey) {
      throw new Error(tr("Push уведомления не настроены на сервере"))
    }

    setPublicKey(data.publicKey)
    return data.publicKey
  }, [tr])

  useEffect(() => {
    const isSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    setSupported(isSupported)

    if (!isSupported) {
      return
    }

    if (!publicKey) {
      void fetchPublicKey()
        .catch(() => null)
        .finally(() => {
          setIsCheckingConfig(false)
        })
    } else {
      setIsCheckingConfig(false)
    }

    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setEnabled(Boolean(subscription))
      })
      .catch(() => null)
  }, [fetchPublicKey, publicKey])

  async function subscribe() {
    setLoading(true)
    try {
      const resolvedPublicKey = publicKey ?? (await fetchPublicKey())

      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission()

      if (permission !== "granted") {
        throw new Error(tr("Разрешите уведомления в браузере"))
      }

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(resolvedPublicKey),
        })
      }

      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(tr(data?.message ?? "Не удалось включить уведомления"))
      }

      setEnabled(true)
      toast.success(tr("Уведомления включены"))
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
      toast.success(tr("Уведомления отключены"))
    } catch {
      toast.error(tr("Не удалось отключить уведомления"))
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
      size="icon"
      disabled={loading || isCheckingConfig}
      onClick={() => (enabled ? void unsubscribe() : void subscribe())}
      aria-label={enabled ? tr("Отключить push-уведомления") : tr("Включить push-уведомления")}
      title={enabled ? tr("Push включены") : tr("Включить push")}
    >
      <BellIcon className="size-4" />
    </Button>
  )
}
