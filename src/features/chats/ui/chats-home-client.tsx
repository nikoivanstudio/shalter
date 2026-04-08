"use client"

import dynamic from "next/dynamic"

import type { ChatsHomeProps } from "@/features/chats/ui/chats-home"

const ChatsHomeNoSsr = dynamic(
  () => import("@/features/chats/ui/chats-home").then((module) => module.ChatsHome),
  {
    ssr: false,
    loading: () => <div className="p-6 text-sm text-muted-foreground">Загрузка чатов...</div>,
  }
)

export function ChatsHomeClient(props: ChatsHomeProps) {
  return <ChatsHomeNoSsr {...props} />
}
