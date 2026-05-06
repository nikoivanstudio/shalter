"use client"

import {
  BotIcon,
  HardDriveIcon,
  MessageCircleIcon,
  NewspaperIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/features/i18n/model/i18n-provider"

type NavSection = "settings" | "contacts" | "chats" | "channels" | "feed" | "bots" | "server"

type BottomNavProps = {
  active?: NavSection
  onChatsClick?: () => void
  chatsBadgeCount?: number
  showServerTab?: boolean
}

function buildItemClassName(isActive: boolean) {
  return [
    "relative h-auto min-w-0 flex-1 rounded-[1rem] px-0.5 py-1.5 text-[10px] leading-tight transition-all sm:min-w-14 sm:rounded-[1.3rem] sm:px-2 sm:py-2",
    isActive
      ? "bg-primary text-primary-foreground shadow-[0_10px_22px_-14px_rgba(15,23,42,0.85)]"
      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
  ].join(" ")
}

function buildLabelClassName(isActive: boolean) {
  return [
    "truncate text-[9px] transition-all sm:text-[11px]",
    isActive ? "mt-0.5 max-w-full opacity-100" : "max-h-0 max-w-0 opacity-0 sm:mt-0.5 sm:max-h-4 sm:max-w-full sm:opacity-100",
  ].join(" ")
}

export function BottomNav({
  active,
  onChatsClick,
  chatsBadgeCount,
  showServerTab = false,
}: BottomNavProps) {
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
    <nav className="fixed inset-x-0 bottom-0 z-30 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] sm:px-3 sm:pb-3">
      <div className="mx-auto flex w-full max-w-md items-end justify-around gap-1 rounded-[1.35rem] border border-white/45 bg-card/88 px-1.5 py-1.5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/8 sm:max-w-2xl sm:gap-1.5 sm:rounded-[1.8rem] sm:px-2 sm:py-2">
        <Button
          variant={active === "settings" ? "default" : "ghost"}
          className={buildItemClassName(active === "settings")}
          onClick={() => router.push("/")}
        >
          <div className="flex flex-col items-center justify-center gap-0.5">
            <SettingsIcon className="size-4 sm:size-4.5" />
          </div>
          <span className={buildLabelClassName(active === "settings")}>{tr("Настройки")}</span>
        </Button>

        <Button
          variant={active === "contacts" ? "default" : "ghost"}
          className={buildItemClassName(active === "contacts")}
          onClick={() => router.push("/contacts")}
        >
          <div className="flex flex-col items-center justify-center gap-0.5">
            <UsersIcon className="size-4 sm:size-4.5" />
          </div>
          <span className={buildLabelClassName(active === "contacts")}>{tr("Контакты")}</span>
        </Button>

        <Button
          variant={active === "chats" ? "default" : "ghost"}
          className={buildItemClassName(active === "chats")}
          onClick={() => {
            onChatsClick?.()
            router.push("/chats")
          }}
        >
          <div className="flex flex-col items-center justify-center gap-0.5">
            <MessageCircleIcon className="size-4 sm:size-4.5" />
          </div>
          <span className={buildLabelClassName(active === "chats")}>{tr("Чаты")}</span>
          {effectiveChatsBadgeCount > 0 ? (
            <span className="absolute top-0.5 right-0.5 inline-flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground shadow-sm sm:right-1 sm:min-w-5 sm:px-1.5 sm:text-[10px]">
              {effectiveChatsBadgeCount > 99 ? "99+" : effectiveChatsBadgeCount}
            </span>
          ) : null}
        </Button>

        <Button
          variant={active === "feed" ? "default" : "ghost"}
          className={buildItemClassName(active === "feed")}
          onClick={() => router.push("/feed")}
        >
          <div className="flex flex-col items-center justify-center gap-0.5">
            <NewspaperIcon className="size-4 sm:size-4.5" />
          </div>
          <span className={buildLabelClassName(active === "feed")}>{tr("Лента")}</span>
        </Button>

        <Button
          variant={active === "bots" ? "default" : "ghost"}
          className={buildItemClassName(active === "bots")}
          onClick={() => router.push("/bots")}
        >
          <div className="flex flex-col items-center justify-center gap-0.5">
            <BotIcon className="size-4 sm:size-4.5" />
          </div>
          <span className={buildLabelClassName(active === "bots")}>{tr("Боты")}</span>
        </Button>

        {showServerTab ? (
          <Button
            variant={active === "server" ? "default" : "ghost"}
            className={buildItemClassName(active === "server")}
            onClick={() => router.push("/server")}
          >
            <div className="flex flex-col items-center justify-center gap-0.5">
              <HardDriveIcon className="size-4 sm:size-4.5" />
            </div>
            <span className={buildLabelClassName(active === "server")}>Сервер</span>
          </Button>
        ) : null}
      </div>
    </nav>
  )
}
