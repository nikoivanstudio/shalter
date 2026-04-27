"use client"

import { HashIcon, ShieldIcon, StarIcon } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { AccountStatusBadge } from "@/components/ui/account-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/features/i18n/model/i18n-provider"
import { LanguageToggle } from "@/features/i18n/ui/language-toggle"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { buildEmblem, getEmblemTone } from "@/features/profile/lib/emblem"
import { ThemeToggle } from "@/features/theme/ui/theme-toggle"
import { LogoutButton } from "@/features/auth/ui/logout-button"

type UserShort = {
  id: number
  firstName: string
  lastName: string | null
  email: string
  role: string
}

type ContactUser = {
  id: number
  firstName: string
  lastName: string | null
  email: string
  phone: string
  role: string
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
  const emblemTone = getEmblemTone(user.firstName, user.lastName)
  const myRole =
    selectedChannel?.participants.find((participant) => participant.id === user.id)?.channelRole ??
    null
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
      setMessages(null)
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
  }, [selectedChannelId])

  function openChannel(channelId: number) {
    setSelectedChannelId(channelId)
    setSelectedContactIds([])
    setMessageText("")
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
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6 pb-28">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-12 items-center justify-center rounded-full border text-sm font-semibold shadow-sm ${emblemTone}`}
            >
              {emblem}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium">{user.firstName} {user.lastName}</p>
                <AccountStatusBadge role={user.role} email={user.email} />
              </div>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="border-border/80 shadow-xl shadow-black/5">
            <CardHeader>
              <CardTitle className="text-2xl">{tr("Каналы")}</CardTitle>
              <CardDescription>
                {tr("Создавайте каналы, находите их в поиске и управляйте участниками.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2 rounded-xl border border-border/70 p-3">
                <p className="text-sm font-medium">{tr("Создать канал")}</p>
                <Input
                  value={createTitle}
                  onChange={(event) => setCreateTitle(event.target.value)}
                  placeholder="Название канала"
                />
                <Input
                  value={createDescription}
                  onChange={(event) => setCreateDescription(event.target.value)}
                  placeholder="Описание канала"
                />
                <Button
                  onClick={createChannel}
                  disabled={isCreating || createTitle.trim().length < 2}
                  className="w-full"
                >
                    {isCreating ? tr("Создаём...") : tr("Создать канал")}
                </Button>
              </div>

              <div className="space-y-2 rounded-xl border border-border/70 p-3">
                <p className="text-sm font-medium">{tr("Поиск каналов")}</p>
                <div className="flex gap-2">
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={tr("Введите название канала")}
                  />
                  <Button onClick={searchChannels} disabled={isSearching}>
                    {isSearching ? tr("Ищем...") : tr("Найти")}
                  </Button>
                </div>
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {searchResults.map((channel) => (
                    <div key={channel.id} className="rounded-lg border border-border/70 p-3">
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

              <div className="space-y-2">
                <p className="text-sm font-medium">{tr("Мои каналы")}</p>
                <div className="max-h-[45dvh] space-y-2 overflow-y-auto">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        selectedChannelId === channel.id
                          ? "border-primary bg-primary/5"
                          : "border-border/70 hover:bg-muted/50"
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
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-xl shadow-black/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <HashIcon className="size-5" />
                {selectedChannel?.title ?? tr("Выберите чат")}
              </CardTitle>
              <CardDescription>
                {selectedChannel?.description ?? tr("Откройте канал слева или найдите новый в поиске.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedChannel ? (
                <>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="space-y-3">
                      <div className="min-h-[360px] space-y-3 rounded-xl border border-border/70 p-3">
                        {messages === null && (
                          <p className="text-sm text-muted-foreground">Загружаем сообщения...</p>
                        )}
                        {messages?.length === 0 && (
                          <p className="text-sm text-muted-foreground">Сообщений пока нет.</p>
                        )}
                        {messages?.map((message) => (
                          <div key={message.id} className="rounded-lg border border-border/70 p-3">
                            <p>{message.content}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {message.author.firstName} {message.author.lastName ?? ""} ·{" "}
                              {new Date(message.createdAt).toLocaleString("ru-RU")}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Input
                          value={messageText}
                          onChange={(event) => setMessageText(event.target.value)}
                          placeholder={
                            canWrite
                              ? "Сообщение в канал"
                              : "Писать могут только владелец и админы"
                          }
                          disabled={!canWrite || isSending}
                        />
                        <Button
                          onClick={sendMessage}
                          disabled={!canWrite || isSending || !messageText.trim()}
                        >
                          {isSending ? "Отправляем..." : "Отправить"}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-xl border border-border/70 p-3">
                        <p className="text-sm font-medium">Участники</p>
                        <div className="mt-3 space-y-2">
                          {selectedChannel.participants.map((participant) => (
                            <div key={participant.id} className="rounded-lg border border-border/70 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate font-medium">
                                      {participant.firstName} {participant.lastName ?? ""}
                                    </p>
                                    <AccountStatusBadge
                                      role={participant.role}
                                      email={participant.email}
                                    />
                                  </div>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {participant.email}
                                  </p>
                                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                    {participant.channelRole === "OWNER" && (
                                      <span className="inline-flex items-center gap-1">
                                        <StarIcon className="size-3" />
                                        Владелец
                                      </span>
                                    )}
                                    {participant.channelRole === "ADMIN" && (
                                      <span className="inline-flex items-center gap-1">
                                        <ShieldIcon className="size-3" />
                                        Админ
                                      </span>
                                    )}
                                    {participant.channelRole === "MEMBER" && <span>Участник</span>}
                                  </div>
                                </div>
                                {canManage && participant.channelRole !== "OWNER" && (
                                  <Button
                                    size="sm"
                                    variant={
                                      participant.channelRole === "ADMIN" ? "outline" : "default"
                                    }
                                    disabled={isUpdatingRole}
                                    onClick={() =>
                                      updateRole(
                                        participant.id,
                                        participant.channelRole === "ADMIN" ? "MEMBER" : "ADMIN"
                                      )
                                    }
                                  >
                                    {participant.channelRole === "ADMIN"
                                      ? "Снять админа"
                                      : "Сделать админом"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {canManage && (
                        <div className="rounded-xl border border-border/70 p-3">
                          <p className="text-sm font-medium">Добавить участников</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Можно добавлять пользователей только из ваших контактов.
                          </p>
                          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                            {availableContacts.map((contact) => (
                              <label
                                key={contact.id}
                                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 p-2 text-sm"
                              >
                                <input
                                  type="checkbox"
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
                                  <AccountStatusBadge role={contact.role} email={contact.email} />
                                </span>
                              </label>
                            ))}
                            {availableContacts.length === 0 && (
                              <p className="text-sm text-muted-foreground">
                                Нет доступных контактов для добавления.
                              </p>
                            )}
                          </div>
                          <Button
                            className="mt-3 w-full"
                            onClick={addParticipants}
                            disabled={isAddingParticipants || selectedContactIds.length === 0}
                          >
                            {isAddingParticipants ? "Добавляем..." : "Добавить выбранных"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Выберите канал слева, чтобы открыть сообщения и участников.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <BottomNav active="channels" />
    </main>
  )
}
