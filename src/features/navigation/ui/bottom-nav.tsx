"use client"

import {
  BotIcon,
  HashIcon,
  MessageCircleIcon,
  NewspaperIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/features/i18n/model/i18n-provider"

type NavSection = "settings" | "contacts" | "chats" | "channels" | "feed" | "bots"

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
    <nav className="fixed inset-x-0 bottom-0 z-30 px-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] sm:px-3 sm:pb-3">
      <div className="mx-auto flex w-full max-w-md items-center justify-around gap-0.5 rounded-[1.45rem] border border-white/50 bg-card/92 px-1 py-1 shadow-[0_18px_42px_-22px_rgba(15,23,42,0.58)] backdrop-blur-2xl dark:border-white/8 sm:max-w-xl sm:gap-1 sm:rounded-[2rem] sm:px-2 sm:py-2">
        <Button
          variant={active === "settings" ? "default" : "ghost"}
          className="h-auto min-w-0 flex-1 flex-col gap-0.5 rounded-[1.1rem] px-0.5 py-1.5 text-[10px] leading-tight sm:min-w-14 sm:gap-1 sm:rounded-[1.45rem] sm:px-2 sm:py-2.5 sm:text-xs"
          onClick={() => router.push("/")}
        >
          <SettingsIcon className="size-3.5 sm:size-4" />
          <span className="truncate text-[9px] sm:text-xs">
            {tr("\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438")}
          </span>
        </Button>
        <Button
          variant={active === "contacts" ? "default" : "ghost"}
          className="h-auto min-w-0 flex-1 flex-col gap-0.5 rounded-[1.1rem] px-0.5 py-1.5 text-[10px] leading-tight sm:min-w-14 sm:gap-1 sm:rounded-[1.45rem] sm:px-2 sm:py-2.5 sm:text-xs"
          onClick={() => router.push("/contacts")}
        >
          <UsersIcon className="size-3.5 sm:size-4" />
          <span className="truncate text-[9px] sm:text-xs">
            {tr("\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b")}
          </span>
        </Button>
        <Button
          variant={active === "chats" ? "default" : "ghost"}
          className="relative h-auto min-w-0 flex-1 flex-col gap-0.5 rounded-[1.1rem] px-0.5 py-1.5 text-[10px] leading-tight sm:min-w-14 sm:gap-1 sm:rounded-[1.45rem] sm:px-2 sm:py-2.5 sm:text-xs"
          onClick={() => {
            onChatsClick?.()
            router.push("/chats")
          }}
        >
          <MessageCircleIcon className="size-3.5 sm:size-4" />
          <span className="truncate text-[9px] sm:text-xs">
            {tr("\u0427\u0430\u0442\u044b")}
          </span>
          {effectiveChatsBadgeCount > 0 && (
            <span className="absolute -top-1 right-0.5 inline-flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground sm:right-1 sm:min-w-5 sm:px-1.5 sm:text-[10px]">
              {effectiveChatsBadgeCount > 99 ? "99+" : effectiveChatsBadgeCount}
            </span>
          )}
        </Button>
        <Button
          variant={active === "feed" ? "default" : "ghost"}
          className="h-auto min-w-0 flex-1 flex-col gap-0.5 rounded-[1.1rem] px-0.5 py-1.5 text-[10px] leading-tight sm:min-w-14 sm:gap-1 sm:rounded-[1.45rem] sm:px-2 sm:py-2.5 sm:text-xs"
          onClick={() => router.push("/feed")}
        >
          <NewspaperIcon className="size-3.5 sm:size-4" />
          <span className="truncate text-[9px] sm:text-xs">
            {tr("\u041b\u0435\u043d\u0442\u0430")}
          </span>
        </Button>
        <Button
          variant={active === "channels" ? "default" : "ghost"}
          className="h-auto min-w-0 flex-1 flex-col gap-0.5 rounded-[1.1rem] px-0.5 py-1.5 text-[10px] leading-tight sm:min-w-14 sm:gap-1 sm:rounded-[1.45rem] sm:px-2 sm:py-2.5 sm:text-xs"
          onClick={() => router.push("/channels")}
        >
          <HashIcon className="size-3.5 sm:size-4" />
          <span className="truncate text-[9px] sm:text-xs">
            {tr("\u041a\u0430\u043d\u0430\u043b\u044b")}
          </span>
        </Button>
        <Button
          variant={active === "bots" ? "default" : "ghost"}
          className="h-auto min-w-0 flex-1 flex-col gap-0.5 rounded-[1.1rem] px-0.5 py-1.5 text-[10px] leading-tight sm:min-w-14 sm:gap-1 sm:rounded-[1.45rem] sm:px-2 sm:py-2.5 sm:text-xs"
          onClick={() => router.push("/bots")}
        >
          <BotIcon className="size-3.5 sm:size-4" />
          <span className="truncate text-[9px] sm:text-xs">
            {tr("\u0411\u043e\u0442\u044b")}
          </span>
        </Button>
      </div>
    </nav>
  )
}
