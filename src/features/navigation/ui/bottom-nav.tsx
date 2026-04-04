"use client"

import { MessageCircleIcon, SettingsIcon, UsersIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

type NavSection = "settings" | "contacts" | "chats"

export function BottomNav({ active }: { active: NavSection }) {
  const router = useRouter()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-around px-4 py-3">
        <Button
          variant={active === "settings" ? "default" : "ghost"}
          className="h-auto flex-col gap-1 px-4 py-2"
          onClick={() => router.push("/")}
        >
          <SettingsIcon className="size-4" />
          <span className="text-xs">Настройки</span>
        </Button>
        <Button
          variant={active === "contacts" ? "default" : "ghost"}
          className="h-auto flex-col gap-1 px-4 py-2"
          onClick={() => router.push("/contacts")}
        >
          <UsersIcon className="size-4" />
          <span className="text-xs">Контакты</span>
        </Button>
        <Button
          variant={active === "chats" ? "default" : "ghost"}
          className="h-auto flex-col gap-1 px-4 py-2"
          onClick={() => router.push("/chats")}
        >
          <MessageCircleIcon className="size-4" />
          <span className="text-xs">Чаты</span>
        </Button>
      </div>
    </nav>
  )
}
