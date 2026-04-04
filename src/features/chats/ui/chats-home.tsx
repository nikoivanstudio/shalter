"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LogoutButton } from "@/features/auth/ui/logout-button"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { buildEmblem } from "@/features/profile/lib/emblem"
import { ThemeToggle } from "@/features/theme/ui/theme-toggle"

type UserShort = {
  id: number
  firstName: string
  lastName: string | null
  email: string
}

type ContactUser = {
  id: number
  firstName: string
  lastName: string | null
  email: string
  phone: string
}

type ChatMessage = {
  id: number
  content: string
  status: string
  createdAt: string
  dialogId: number
  author: {
    id: number
    firstName: string
    lastName: string | null
  }
}

type ChatDialog = {
  id: number
  ownerId: number
  users: UserShort[]
  lastMessage: ChatMessage | null
}

type ChatsHomeProps = {
  user: UserShort
  dialogs: ChatDialog[]
  contacts: ContactUser[]
}

function getUserName(user: { firstName: string; lastName: string | null }) {
  return `${user.firstName} ${user.lastName ?? ""}`.trim()
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getDialogTitle(dialog: ChatDialog, currentUserId: number) {
  const otherUsers = dialog.users.filter((item) => item.id !== currentUserId)
  if (otherUsers.length === 0) {
    return "Личный чат"
  }
  return otherUsers.map((item) => getUserName(item)).join(", ")
}

function withUpdatedDialogMessage(dialogs: ChatDialog[], message: ChatMessage) {
  const index = dialogs.findIndex((item) => item.id === message.dialogId)
  if (index === -1) {
    return dialogs
  }

  const next = [...dialogs]
  const [found] = next.splice(index, 1)
  next.unshift({
    ...found,
    lastMessage: message,
  })
  return next
}

export function ChatsHome({ user, dialogs: initialDialogs, contacts }: ChatsHomeProps) {
  const [dialogs, setDialogs] = useState(initialDialogs)
  const [selectedDialogId, setSelectedDialogId] = useState<number | null>(
    initialDialogs[0]?.id ?? null
  )
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [sseSince, setSseSince] = useState(0)
  const [messageText, setMessageText] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([])
  const [isCreating, startCreating] = useTransition()
  const [isSending, startSending] = useTransition()
  const emblem = buildEmblem(user.firstName, user.lastName)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const activeDialogId = useMemo(() => {
    if (selectedDialogId && dialogs.some((item) => item.id === selectedDialogId)) {
      return selectedDialogId
    }
    return dialogs[0]?.id ?? null
  }, [dialogs, selectedDialogId])

  const selectedDialog = useMemo(
    () => dialogs.find((item) => item.id === activeDialogId) ?? null,
    [activeDialogId, dialogs]
  )
  const isMessageListReady = messages !== null

  useEffect(() => {
    if (!activeDialogId) {
      return
    }

    const controller = new AbortController()

    fetch(`/api/chats/${activeDialogId}/messages`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.message ?? "Не удалось получить сообщения")
        }
        return response.json()
      })
      .then((data: { messages: ChatMessage[] }) => {
        setMessages(data.messages)
        setSseSince(data.messages[data.messages.length - 1]?.id ?? 0)
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          toast.error(error.message)
          setMessages([])
        }
      })

    return () => controller.abort()
  }, [activeDialogId])

  useEffect(() => {
    if (!activeDialogId || !isMessageListReady) {
      return
    }

    const eventSource = new EventSource(`/api/chats/${activeDialogId}/events?since=${sseSince}`)

    eventSource.addEventListener("message", (event) => {
      const nextMessage = JSON.parse((event as MessageEvent<string>).data) as ChatMessage
      setMessages((prev) => {
        if (!prev) {
          return [nextMessage]
        }
        if (prev.some((item) => item.id === nextMessage.id)) {
          return prev
        }
        return [...prev, nextMessage]
      })
      setDialogs((prev) => withUpdatedDialogMessage(prev, nextMessage))
    })

    eventSource.addEventListener("chat-error", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { message?: string }
      toast.error(payload.message ?? "Ошибка обновления чата")
    })

    return () => {
      eventSource.close()
    }
  }, [activeDialogId, isMessageListReady, sseSince])

  useEffect(() => {
    if (!isMessageListReady) {
      return
    }

    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    })
  }, [activeDialogId, isMessageListReady, messages])

  function toggleContact(contactId: number) {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    )
  }

  function createChat() {
    if (selectedContactIds.length === 0) {
      toast.error("Выберите хотя бы один контакт")
      return
    }

    startCreating(async () => {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantIds: selectedContactIds }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось создать чат")
        return
      }

      const dialog = data.dialog as ChatDialog
      setDialogs((prev) => [dialog, ...prev])
      setSelectedDialogId(dialog.id)
      setMessages(null)
      setSseSince(0)
      setSelectedContactIds([])
      setShowCreateForm(false)
      toast.success("Чат создан")
    })
  }

  function sendMessage() {
    if (!activeDialogId) {
      return
    }

    const content = messageText.trim()
    if (!content) {
      return
    }

    startSending(async () => {
      const response = await fetch(`/api/chats/${activeDialogId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось отправить сообщение")
        return
      }

      const nextMessage = data.message as ChatMessage
      setMessageText("")
      setMessages((prev) => {
        if (!prev) {
          return [nextMessage]
        }
        if (prev.some((item) => item.id === nextMessage.id)) {
          return prev
        }
        return [...prev, nextMessage]
      })
      setDialogs((prev) => withUpdatedDialogMessage(prev, nextMessage))
    })
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6 pb-28">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full border border-border/80 bg-card text-sm font-semibold shadow-sm">
              {emblem}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{getUserName(user)}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>

        <Card className="border-border/80 shadow-xl shadow-black/5">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">Чаты</CardTitle>
                <CardDescription>Общайтесь с пользователями из ваших контактов.</CardDescription>
              </div>
              <div className="space-y-1">
                <Button
                  onClick={() => setShowCreateForm((prev) => !prev)}
                  disabled={contacts.length === 0}
                >
                  Создать чат
                </Button>
                {contacts.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Чтобы создать чат, сначала добавьте контакты.
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showCreateForm && contacts.length > 0 && (
              <div className="space-y-3 rounded-xl border border-border/70 p-3">
                <p className="text-sm font-medium">Выберите пользователей для нового чата</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {contacts.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 p-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedContactIds.includes(contact.id)}
                        onChange={() => toggleContact(contact.id)}
                      />
                      <span className="truncate">{getUserName(contact)}</span>
                    </label>
                  ))}
                </div>
                <Button onClick={createChat} disabled={isCreating || selectedContactIds.length === 0}>
                  {isCreating ? "Создаём..." : "Создать"}
                </Button>
              </div>
            )}

            {dialogs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
                Чаты отсутствуют. Создайте новый чат с пользователем из контактов.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-[280px_1fr]">
                <div className="max-h-[520px] space-y-2 overflow-y-auto rounded-xl border border-border/70 p-2">
                  {dialogs.map((dialog) => (
                    <button
                      key={dialog.id}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        activeDialogId === dialog.id
                          ? "border-primary/50 bg-primary/10"
                          : "border-border/60 hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        setSelectedDialogId(dialog.id)
                        setMessages(null)
                        setSseSince(0)
                      }}
                    >
                      <p className="truncate text-sm font-medium">
                        {getDialogTitle(dialog, user.id)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {dialog.lastMessage?.content ?? "Сообщений пока нет"}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="flex h-[520px] flex-col rounded-xl border border-border/70">
                  <div className="border-b border-border/70 px-4 py-3">
                    <p className="truncate text-sm font-medium">
                      {selectedDialog ? getDialogTitle(selectedDialog, user.id) : "Выберите чат"}
                    </p>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                    {messages === null && (
                      <p className="text-sm text-muted-foreground">Загружаем сообщения...</p>
                    )}
                    {messages !== null && messages.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Сообщений пока нет. Напишите первое сообщение.
                      </p>
                    )}
                    {messages !== null &&
                      messages.map((message) => {
                        const mine = message.author.id === user.id
                        return (
                          <div
                            key={message.id}
                            className={`flex ${mine ? "justify-start" : "justify-end"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                                mine
                                  ? "bg-primary/15 text-foreground"
                                  : "bg-secondary text-secondary-foreground"
                              }`}
                            >
                              <p>{message.content}</p>
                              <p className="mt-1 text-[11px] opacity-70">
                                {getUserName(message.author)} · {formatTime(message.createdAt)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="flex items-center gap-2 border-t border-border/70 p-3">
                    <Input
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      placeholder="Введите сообщение"
                      disabled={!activeDialogId || isSending}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault()
                          sendMessage()
                        }
                      }}
                    />
                    <Button onClick={sendMessage} disabled={!activeDialogId || isSending}>
                      {isSending ? "Отправка..." : "Отправить"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <BottomNav active="chats" />
    </main>
  )
}
