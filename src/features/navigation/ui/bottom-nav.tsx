"use client"

import { HashIcon, MessageCircleIcon, NewspaperIcon, SettingsIcon, UsersIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/features/i18n/model/i18n-provider"

type NavSection = "settings" | "contacts" | "chats" | "channels" | "feed"

export function BottomNav({
  active,
  onChatsClick,
  chatsBadgeCount,
}: {
  active?: NavSection
  onChatsClick?: () => void
  chatsBadgeCount?: number
}) {
  const router = useRouter()
  const { tr } = useI18n()
  const [liveChatsBadgeCount, setLiveChatsBadgeCount] = useState(0)
  const useExternalBadge = typeof chatsBadgeCount === "number"
  const effectiveChatsBadgeCount = useExternalBadge ? chatsBadgeCount : liveChatsBadgeCount

  useEffect(() => {
    if (useExternalBadge) {
      return
    }

    const eventSource = new EventSource("/api/chats/unread/events")

    eventSource.addEventListener("unread", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        dialogsWithUnread?: number
      }
      setLiveChatsBadgeCount(payload.dialogsWithUnread ?? 0)
    })

    return () => {
      eventSource.close()
    }
  }, [useExternalBadge])

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-around px-4 py-3">
        <Button
          variant={active === "settings" ? "default" : "ghost"}
          className="h-auto flex-col gap-1 px-4 py-2"
          onClick={() => router.push("/")}
        >
          <SettingsIcon className="size-4" />
          <span className="text-xs">{tr("Настройки")}</span>
        </Button>
        <Button
          variant={active === "contacts" ? "default" : "ghost"}
          className="h-auto flex-col gap-1 px-4 py-2"
          onClick={() => router.push("/contacts")}
        >
          <UsersIcon className="size-4" />
          <span className="text-xs">{tr("Контакты")}</span>
        </Button>
        <Button
          variant={active === "chats" ? "default" : "ghost"}
          className="relative h-auto flex-col gap-1 px-4 py-2"
          onClick={() => {
            onChatsClick?.()
            router.push("/chats")
          }}
        >
          <MessageCircleIcon className="size-4" />
          <span className="text-xs">{tr("Чаты")}</span>
          {effectiveChatsBadgeCount > 0 && (
            <span className="absolute -top-1 right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
              {effectiveChatsBadgeCount > 99 ? "99+" : effectiveChatsBadgeCount}
            </span>
          )}
        </Button>
        <Button
          variant={active === "feed" ? "default" : "ghost"}
          className="h-auto flex-col gap-1 px-4 py-2"
          onClick={() => router.push("/feed")}
        >
          <NewspaperIcon className="size-4" />
          <span className="text-xs">Лента</span>
        </Button>
        <Button
          variant={active === "channels" ? "default" : "ghost"}
          className="h-auto flex-col gap-1 px-4 py-2"
          onClick={() => router.push("/channels")}
        >
          <HashIcon className="size-4" />
          <span className="text-xs">{tr("Каналы")}</span>
        </Button>
      </div>
    </nav>
  )
}
