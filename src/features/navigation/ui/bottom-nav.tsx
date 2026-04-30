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
    <nav className="fixed inset-x-0 bottom-0 z-30 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3 sm:pb-3">
      <div className="mx-auto flex w-full max-w-md items-center justify-around gap-1 rounded-[1.7rem] border border-white/50 bg-card/92 px-1.5 py-1.5 shadow-[0_18px_42px_-22px_rgba(15,23,42,0.58)] backdrop-blur-2xl dark:border-white/8 sm:max-w-xl sm:rounded-[2rem] sm:px-2 sm:py-2">
        <Button
          variant={active === "settings" ? "default" : "ghost"}
          className="h-auto min-w-11 flex-1 flex-col gap-0.5 rounded-[1.25rem] px-1 py-2 text-[11px] sm:min-w-14 sm:gap-1 sm:rounded-[1.45rem] sm:px-2 sm:py-2.5 sm:text-xs"
          onClick={() => router.push("/")}
        >
          <SettingsIcon className="size-4" />
          <span className="text-[10px] sm:text-xs">{tr("РќР°СЃС‚СЂРѕР№РєРё")}</span>
        </Button>
        <Button
          variant={active === "contacts" ? "default" : "ghost"}
          className="h-auto min-w-11 flex-1 flex-col gap-0.5 rounded-[1.25rem] px-1 py-2 text-[11px] sm:min-w-14 sm:gap-1 sm:rounded-[1.45rem] sm:px-2 sm:py-2.5 sm:text-xs"
          onClick={() => router.push("/contacts")}
        >
          <UsersIcon className="size-4" />
          <span className="text-[10px] sm:text-xs">{tr("РљРѕРЅС‚Р°РєС‚С‹")}</span>
        </Button>
        <Button
          variant={active === "chats" ? "default" : "ghost"}
          className="relative h-auto min-w-11 flex-1 flex-col gap-0.5 rounded-[1.25rem] px-1 py-2 text-[11px] sm:min-w-14 sm:gap-1 sm:rounded-[1.45rem] sm:px-2 sm:py-2.5 sm:text-xs"
          onClick={() => {
            onChatsClick?.()
            router.push("/chats")
          }}
        >
          <MessageCircleIcon className="size-4" />
          <span className="text-[10px] sm:text-xs">{tr("Р§Р°С‚С‹")}</span>
          {effectiveChatsBadgeCount > 0 && (
            <span className="absolute -top-1 right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
              {effectiveChatsBadgeCount > 99 ? "99+" : effectiveChatsBadgeCount}
            </span>
          )}
        </Button>
        <Button
          variant={active === "feed" ? "default" : "ghost"}
          className="h-auto min-w-11 flex-1 flex-col gap-0.5 rounded-[1.25rem] px-1 py-2 text-[11px] sm:min-w-14 sm:gap-1 sm:rounded-[1.45rem] sm:px-2 sm:py-2.5 sm:text-xs"
          onClick={() => router.push("/feed")}
        >
          <NewspaperIcon className="size-4" />
          <span className="text-[10px] sm:text-xs">Р›РµРЅС‚Р°</span>
        </Button>
        <Button
          variant={active === "channels" ? "default" : "ghost"}
          className="h-auto min-w-11 flex-1 flex-col gap-0.5 rounded-[1.25rem] px-1 py-2 text-[11px] sm:min-w-14 sm:gap-1 sm:rounded-[1.45rem] sm:px-2 sm:py-2.5 sm:text-xs"
          onClick={() => router.push("/channels")}
        >
          <HashIcon className="size-4" />
          <span className="text-[10px] sm:text-xs">{tr("РљР°РЅР°Р»С‹")}</span>
        </Button>
        <Button
          variant={active === "bots" ? "default" : "ghost"}
          className="h-auto min-w-11 flex-1 flex-col gap-0.5 rounded-[1.25rem] px-1 py-2 text-[11px] sm:min-w-14 sm:gap-1 sm:rounded-[1.45rem] sm:px-2 sm:py-2.5 sm:text-xs"
          onClick={() => router.push("/bots")}
        >
          <BotIcon className="size-4" />
          <span className="text-[10px] sm:text-xs">{tr("Боты")}</span>
        </Button>
      </div>
    </nav>
  )
}
