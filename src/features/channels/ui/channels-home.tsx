"use client"

import {
  ArrowLeftIcon,
  HashIcon,
  SearchIcon,
  ShieldIcon,
  StarIcon,
  UsersIcon,
} from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { AccountStatusBadge } from "@/components/ui/account-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LogoutButton } from "@/features/auth/ui/logout-button"
import { useI18n } from "@/features/i18n/model/i18n-provider"
import { LanguageToggle } from "@/features/i18n/ui/language-toggle"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { buildEmblem, getEmblemTone } from "@/features/profile/lib/emblem"
import { ThemeToggle } from "@/features/theme/ui/theme-toggle"

type UserShort = {
  id: number
  firstName: string
  lastName: string | null
  email: string
  role: string
  avatarTone?: string | null
  isBlocked?: boolean
}

type ContactUser = {
  id: number
  firstName: string
  lastName: string | null
  email: string
  phone: string
  role: string
  isBlocked?: boolean
}

type ChannelParticipant = UserShort & {
  channelRole: "OWNER" | "ADMIN" | "MEMBER"
}

type ChannelMessage = {
  id: number
  channelId: number
  content: string
  createdAt: string
  author: {
    id: number
    firstName: string
    lastName: string | null
  }
}

type ChannelItem = {
  id: number
  title: string
  description: string | null
  ownerId: number
  myRole: "OWNER" | "ADMIN" | "MEMBER" | null
  participants: ChannelParticipant[]
  lastMessage: ChannelMessage | null
}

type SearchChannel = {
  id: number
  title: string
  description: string | null
  ownerId: number
  memberCount: number
  joined: boolean
  myRole: "OWNER" | "ADMIN" | "MEMBER" | null
}

export function ChannelsHome({
  user,
  channels: initialChannels,
  contacts,
  initialChannelId,
}: {
  user: UserShort
  channels: ChannelItem[]
  contacts: ContactUser[]
  initialChannelId: number | null
}) {
  const { tr } = useI18n()
  const [channels, setChannels] = useState(initialChannels)
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(initialChannelId)
  const [messages, setMessages] = useState<ChannelMessage[] | null>(null)
  const [createTitle, setCreateTitle] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchChannel[]>([])
  const [messageText, setMessageText] = useState("")
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([])
  const [showMembers, setShowMembers] = useState(false)
  const [isCreating, startCreating] = useTransition()
  const [isSearching, startSearching] = useTransition()
  const [isJoining, startJoining] = useTransition()
  const [isSending, startSending] = useTransition()
  const [isUpdatingRole, startUpdatingRole] = useTransition()
  const [isAddingParticipants, startAddingParticipants] = useTransition()

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) ?? null,
    [channels, selectedChannelId]
  )
  const emblem = buildEmblem(user.firstName, user.lastName)
  const emblemTone = getEmblemTone(user.firstName, user.lastName, user.avatarTone)
  const myRole = selectedChannel?.myRole ?? null
  const canManage = myRole === "OWNER"
  const canWrite = myRole === "OWNER" || myRole === "ADMIN"
  const availableContacts = useMemo(() => {
    if (!selectedChannel) {
      return []
    }

    const participantIds = new Set(selectedChannel.participants.map((participant) => participant.id))
    return contacts.filter((contact) => !participantIds.has(contact.id))
  }, [contacts, selectedChannel])

  useEffect(() => {
    if (!selectedChannelId) {
      return
    }

    let cancelled = false
    fetch(`/api/channels/${selectedChannelId}/messages`)
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(tr(data?.message ?? "Не удалось загрузить сообщения канала"))
        }
        return data as { messages: ChannelMessage[] }
      })
      .then((data) => {
        if (!cancelled) {
          setMessages(data.messages)
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          toast.error(tr(error.message))
          setMessages([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedChannelId, tr])

  function openChannel(channelId: number) {
    setSelectedChannelId(channelId)
    setMessages(null)
    setSelectedContactIds([])
    setMessageText("")
    setShowMembers(false)
  }

  function createChannel() {
    startCreating(async () => {
      const response = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle,
          description: createDescription,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось создать канал"))
        return
      }

      const channel = data.channel as ChannelItem
      setChannels((prev) => [channel, ...prev])
      setCreateTitle("")
      setCreateDescription("")
      setSelectedChannelId(channel.id)
      setMessages([])
      toast.success(tr("Канал создан"))
    })
  }

  function searchChannels() {
    startSearching(async () => {
      const response = await fetch(`/api/channels/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось выполнить поиск"))
        return
      }

      setSearchResults((data?.channels ?? []) as SearchChannel[])
    })
  }

  function joinChannel(channelId: number) {
    startJoining(async () => {
      const response = await fetch(`/api/channels/${channelId}/join`, {
        method: "POST",
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось вступить в канал"))
        return
      }

      location.assign(`/channels?channelId=${channelId}`)
    })
  }

  function sendMessage() {
    if (!selectedChannelId) {
      return
    }

    startSending(async () => {
      const response = await fetch(`/api/channels/${selectedChannelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageText }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось отправить сообщение"))
        return
      }

      const nextMessage = data.message as ChannelMessage
      setMessages((prev) => (prev ? [...prev, nextMessage] : [nextMessage]))
      setChannels((prev) =>
        prev.map((channel) =>
          channel.id === selectedChannelId ? { ...channel, lastMessage: nextMessage } : channel
        )
      )
      setMessageText("")
    })
  }

  function addParticipants() {
    if (!selectedChannelId) {
      return
    }

    startAddingParticipants(async () => {
      const response = await fetch(`/api/channels/${selectedChannelId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantIds: selectedContactIds }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось добавить участников"))
        return
      }

      const participants = data.participants as ChannelParticipant[]
      setChannels((prev) =>
        prev.map((channel) =>
          channel.id === selectedChannelId
            ? { ...channel, participants: [...channel.participants, ...participants] }
            : channel
        )
      )
      setSelectedContactIds([])
      toast.success(tr("Участники добавлены"))
    })
  }

  function updateRole(targetUserId: number, role: "ADMIN" | "MEMBER") {
    if (!selectedChannelId) {
      return
    }

    startUpdatingRole(async () => {
      const response = await fetch(`/api/channels/${selectedChannelId}/participants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, role }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось обновить роль"))
        return
      }

      const participant = data.participant as ChannelParticipant
      setChannels((prev) =>
        prev.map((channel) =>
          channel.id === selectedChannelId
            ? {
                ...channel,
                participants: channel.participants.map((item) =>
                  item.id === participant.id ? participant : item
                ),
              }
            : channel
        )
      )
      toast.success(tr(role === "ADMIN" ? "Админ назначен" : "Права админа сняты"))
    })
  }

  return (
    <main className="min-h-screen px-4 py-5 pb-28 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="rounded-[2rem] border border-white/50 bg-card/88 px-5 py-4 shadow-[0_20px_55px_-32px_rgba(15,23,42,0.48)] backdrop-blur-xl dark:border-white/8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex size-14 items-center justify-center rounded-full border border-white/55 text-sm font-semibold shadow-lg shadow-sky-500/10 ${emblemTone}`}
              >
                {emblem}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-lg font-semibold">
                    {user.firstName} {user.lastName ?? ""}
                  </p>
                  <AccountStatusBadge
                    role={user.role}
                    email={user.email}
                    firstName={user.firstName}
                    lastName={user.lastName}
                    isBlocked={user.isBlocked}
                  />
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {tr("Управляйте каналами в том же окне, как и чатами.")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
        </header>

        <section className="mx-auto flex w-full max-w-6xl min-h-0">
          <Card className="flex min-h-[78dvh] w-full flex-col border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
            <CardContent className="grid min-h-0 flex-1 gap-0 p-0 lg:grid-cols-[360px_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col border-b border-border/60 p-4 lg:border-r lg:border-b-0">
                <div className="rounded-[1.5rem] border border-border/70 bg-background/72 p-4 shadow-sm">
                  <p className="text-sm font-medium">{tr("Создать канал")}</p>
                  <div className="mt-3 space-y-2">
                    <Input
                      value={createTitle}
                      onChange={(event) => setCreateTitle(event.target.value)}
                      placeholder={tr("Название канала")}
                    />
                    <Input
                      value={createDescription}
                      onChange={(event) => setCreateDescription(event.target.value)}
                      placeholder={tr("Описание канала")}
                    />
                    <Button
                      onClick={createChannel}
                      disabled={isCreating || createTitle.trim().length < 2}
                      className="w-full"
                    >
                      {isCreating ? tr("Создаём...") : tr("Создать канал")}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.5rem] border border-border/70 bg-background/72 p-4 shadow-sm">
                  <p className="text-sm font-medium">{tr("Поиск каналов")}</p>
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder={tr("Введите название канала")}
                    />
                    <Button size="icon" onClick={searchChannels} disabled={isSearching}>
                      <SearchIcon className="size-4" />
                    </Button>
                  </div>
                  <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                    {searchResults.map((channel) => (
                      <div
                        key={channel.id}
                        className="rounded-[1.2rem] border border-border/70 bg-card/70 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{channel.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {channel.description || tr("Без описания")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {tr("Участников:")} {channel.memberCount}
                            </p>
                          </div>
                          {channel.joined ? (
                            <Button size="sm" variant="outline" onClick={() => openChannel(channel.id)}>
                              {tr("Открыть")}
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => joinChannel(channel.id)} disabled={isJoining}>
                              {tr("Вступить")}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {searchQuery.trim() && searchResults.length === 0 && (
                      <p className="text-sm text-muted-foreground">{tr("Каналы не найдены.")}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 min-h-0 flex-1 rounded-[1.5rem] border border-border/70 bg-background/72 p-3 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{tr("Мои каналы")}</p>
                      <p className="text-xs text-muted-foreground">{tr("Мои каналы и поиск")}</p>
                    </div>
                  </div>
                  <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
                    {channels.map((channel) => (
                      <button
                        key={channel.id}
                        className={`w-full rounded-[1.25rem] border p-3 text-left transition-colors ${
                          selectedChannelId === channel.id
                            ? "border-primary/70 bg-primary/10"
                            : "border-border/70 bg-background/82 hover:bg-accent/40"
                        }`}
                        onClick={() => openChannel(channel.id)}
                      >
                        <p className="truncate font-medium">{channel.title}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {channel.lastMessage?.content ?? channel.description ?? tr("Сообщений пока нет")}
                        </p>
                      </button>
                    ))}
                    {channels.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {tr("Вы пока не состоите ни в одном канале.")}
                      </p>
                    )}
                  </div>
                </div>
              </aside>

              <section className="flex min-h-0 flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-background/72 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold">
                      <HashIcon className="size-4" />
                      {selectedChannel?.title ?? tr("Канал")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {selectedChannel?.description ?? tr("Откройте канал из списка или создайте новый.")}
                    </p>
                  </div>
                  {selectedChannel && canManage && (
                    <Button size="sm" variant="outline" onClick={() => setShowMembers((prev) => !prev)}>
                      <UsersIcon className="size-4" />
                      {showMembers ? tr("Скрыть участников") : tr("Участники")}
                    </Button>
                  )}
                </div>

                {selectedChannel && canManage && showMembers && (
                  <div className="max-h-[40dvh] overflow-y-auto border-b border-border/60 bg-muted/28 px-4 py-3">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{tr("Участники канала")}</p>
                        {selectedChannel.participants.map((participant) => (
                          <div
                            key={participant.id}
                            className="rounded-[1.2rem] border border-border/70 bg-background/86 px-3 py-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-medium">
                                    {participant.firstName} {participant.lastName ?? ""}
                                  </p>
                                  <AccountStatusBadge
                                    role={participant.role}
                                    email={participant.email}
                                    firstName={participant.firstName}
                                    lastName={participant.lastName}
                                    isBlocked={participant.isBlocked}
                                  />
                                </div>
                                <p className="truncate text-xs text-muted-foreground">
                                  {participant.email}
                                </p>
                                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                  {participant.channelRole === "OWNER" && (
                                    <span className="inline-flex items-center gap-1">
                                      <StarIcon className="size-3" />
                                      {tr("Владелец")}
                                    </span>
                                  )}
                                  {participant.channelRole === "ADMIN" && (
                                    <span className="inline-flex items-center gap-1">
                                      <ShieldIcon className="size-3" />
                                      {tr("Админ")}
                                    </span>
                                  )}
                                  {participant.channelRole === "MEMBER" && <span>{tr("Участник")}</span>}
                                </div>
                              </div>
                              {canManage && participant.channelRole !== "OWNER" && (
                                <Button
                                  size="sm"
                                  variant={participant.channelRole === "ADMIN" ? "outline" : "default"}
                                  disabled={isUpdatingRole}
                                  onClick={() =>
                                    updateRole(
                                      participant.id,
                                      participant.channelRole === "ADMIN" ? "MEMBER" : "ADMIN"
                                    )
                                  }
                                >
                                  {participant.channelRole === "ADMIN"
                                    ? tr("Снять админа")
                                    : tr("Сделать админом")}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {canManage && (
                        <div className="rounded-[1.2rem] border border-border/70 bg-background/86 p-3">
                          <p className="text-sm font-medium">{tr("Добавить участников")}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {tr("Доступны только пользователи из ваших контактов.")}
                          </p>
                          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                            {availableContacts.map((contact) => (
                              <label
                                key={contact.id}
                                className="flex cursor-pointer items-center gap-2 rounded-[1rem] border border-border/70 bg-card/70 p-2 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  className="size-4 shrink-0 accent-primary"
                                  checked={selectedContactIds.includes(contact.id)}
                                  onChange={() =>
                                    setSelectedContactIds((prev) =>
                                      prev.includes(contact.id)
                                        ? prev.filter((id) => id !== contact.id)
                                        : [...prev, contact.id]
                                    )
                                  }
                                />
                                <span className="flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="truncate">
                                    {contact.firstName} {contact.lastName ?? ""}
                                  </span>
                                  <AccountStatusBadge
                                    role={contact.role}
                                    email={contact.email}
                                    firstName={contact.firstName}
                                    lastName={contact.lastName}
                                    isBlocked={contact.isBlocked}
                                  />
                                </span>
                              </label>
                            ))}
                            {availableContacts.length === 0 && (
                              <p className="text-sm text-muted-foreground">
                                {tr("Нет доступных контактов для добавления.")}
                              </p>
                            )}
                          </div>
                          <Button
                            className="mt-3 w-full"
                            onClick={addParticipants}
                            disabled={isAddingParticipants || selectedContactIds.length === 0}
                          >
                            {isAddingParticipants ? tr("Добавляем...") : tr("Добавить выбранных")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="chat-wall min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-24">
                  {!selectedChannel && (
                    <p className="text-sm text-muted-foreground">
                      {tr("Откройте канал из списка или создайте новый.")}
                    </p>
                  )}
                  {selectedChannel && messages === null && (
                    <p className="text-sm text-muted-foreground">{tr("Загружаем сообщения...")}</p>
                  )}
                  {selectedChannel && messages?.length === 0 && (
                    <p className="text-sm text-muted-foreground">{tr("Сообщений пока нет.")}</p>
                  )}
                  {messages?.map((message) => {
                    const mine = message.author.id === user.id
                    return (
                      <div
                        key={message.id}
                        className={`mb-3 flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`w-fit max-w-[85%] rounded-[1.35rem] px-3.5 py-2.5 text-sm shadow-sm ${
                            mine
                              ? "rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-bl-md border border-white/45 bg-background/96 text-foreground dark:border-white/8"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          <p className="mt-1 text-[11px] opacity-75">
                            {!mine &&
                              `${message.author.firstName} ${message.author.lastName ?? ""} · `}
                            {new Date(message.createdAt).toLocaleString("ru-RU")}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="sticky bottom-0 shrink-0 border-t border-border/70 bg-background/88 p-3 backdrop-blur-xl">
                  <div className="flex items-center gap-2 rounded-[1.85rem] border border-white/45 bg-card/92 p-2.5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.65)] dark:border-white/8">
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 lg:hidden"
                      onClick={() => setShowMembers((prev) => !prev)}
                      disabled={!selectedChannel || !canManage}
                    >
                      <ArrowLeftIcon className="size-4" />
                    </Button>
                    <Input
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                      placeholder={
                        canWrite ? tr("Сообщение в канал") : tr("Писать могут только владелец и админы")
                      }
                      disabled={!canWrite || isSending || !selectedChannel}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault()
                          sendMessage()
                        }
                      }}
                    />
                    <Button
                      className="min-w-28 rounded-full"
                      onClick={sendMessage}
                      disabled={!canWrite || isSending || !messageText.trim() || !selectedChannel}
                    >
                      {isSending ? tr("Отправляем...") : tr("Отправить")}
                    </Button>
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>
        </section>
      </div>

      <BottomNav active="channels" />
    </main>
  )
}
