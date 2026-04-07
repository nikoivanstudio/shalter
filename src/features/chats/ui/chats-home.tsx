"use client"

import { ArrowLeftIcon, CheckIcon } from "lucide-react"
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
  status: "SENT" | "DELIVERED" | "READ"
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
  initialDialogId: number | null
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

function MessageStatusIcon({ status }: { status: ChatMessage["status"] }) {
  if (status === "SENT") {
    return <CheckIcon className="size-3" />
  }

  const toneClass = status === "READ" ? "text-sky-500" : ""
  return (
    <span className={`inline-flex ${toneClass}`}>
      <CheckIcon className="-mr-1 size-3" />
      <CheckIcon className="size-3" />
    </span>
  )
}

export function ChatsHome({ user, dialogs: initialDialogs, contacts, initialDialogId }: ChatsHomeProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [dialogs, setDialogs] = useState(initialDialogs)
  const [selectedDialogId, setSelectedDialogId] = useState<number | null>(
    initialDialogId ?? initialDialogs[0]?.id ?? null
  )
  const [isDialogView, setIsDialogView] = useState(Boolean(initialDialogId))
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [sseSince, setSseSince] = useState(0)
  const [messageText, setMessageText] = useState("")
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([])
  const [isCreating, startCreating] = useTransition()
  const [isSending, startSending] = useTransition()
  const [isEditing, startEditing] = useTransition()
  const [isDeleting, startDeleting] = useTransition()
  const emblem = buildEmblem(user.firstName, user.lastName)

  const activeDialogId = useMemo(() => {
    if (selectedDialogId && dialogs.some((item) => item.id === selectedDialogId)) {
      return selectedDialogId
    }
    return null
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

    eventSource.addEventListener("status", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        id: number
        status: ChatMessage["status"]
      }
      setMessages((prev) =>
        prev
          ? prev.map((item) =>
              item.id === payload.id ? { ...item, status: payload.status } : item
            )
          : prev
      )
      setDialogs((prev) =>
        prev.map((dialog) =>
          dialog.id === activeDialogId && dialog.lastMessage?.id === payload.id
            ? { ...dialog, lastMessage: { ...dialog.lastMessage, status: payload.status } }
            : dialog
        )
      )
    })

    return () => eventSource.close()
  }, [activeDialogId, isMessageListReady, sseSince])

  useEffect(() => {
    if (!activeDialogId || !messages || messages.length === 0) {
      return
    }

    const unreadIncomingIds = messages
      .filter((message) => message.author.id !== user.id && message.status !== "READ")
      .map((message) => message.id)

    if (unreadIncomingIds.length === 0) {
      return
    }

    void fetch(`/api/chats/${activeDialogId}/messages/read`, { method: "POST" })
      .then(async (response) => {
        if (!response.ok) {
          return
        }
        const data = (await response.json().catch(() => null)) as
          | { readMessageIds?: number[] }
          | null
        const readSet = new Set(data?.readMessageIds ?? [])
        if (readSet.size === 0) {
          return
        }

        setMessages((prev) =>
          prev
            ? prev.map((item) =>
                readSet.has(item.id) ? { ...item, status: "READ" } : item
              )
            : prev
        )
        setDialogs((prev) =>
          prev.map((dialog) =>
            dialog.id === activeDialogId && dialog.lastMessage && readSet.has(dialog.lastMessage.id)
              ? { ...dialog, lastMessage: { ...dialog.lastMessage, status: "READ" } }
              : dialog
          )
        )
      })
      .catch(() => null)
  }, [activeDialogId, messages, user.id])

  useEffect(() => {
    if (!isMessageListReady || !isDialogView) {
      return
    }

    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    })
  }, [activeDialogId, isDialogView, isMessageListReady, messages])

  function openDialog(dialogId: number) {
    setSelectedDialogId(dialogId)
    setMessages(null)
    setSseSince(0)
    setIsDialogView(true)
    setShowCreateForm(false)
    setEditingMessageId(null)
  }

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
      setSelectedContactIds([])
      openDialog(dialog.id)
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

  function beginEdit(message: ChatMessage) {
    setEditingMessageId(message.id)
    setEditingText(message.content)
  }

  function saveEdit(messageId: number) {
    if (!activeDialogId) {
      return
    }

    const content = editingText.trim()
    if (!content) {
      toast.error("Сообщение не может быть пустым")
      return
    }

    startEditing(async () => {
      const response = await fetch(`/api/chats/${activeDialogId}/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось изменить сообщение")
        return
      }

      const updated = data.message as ChatMessage
      setMessages((prev) =>
        prev ? prev.map((item) => (item.id === updated.id ? { ...item, content: updated.content } : item)) : prev
      )
      setDialogs((prev) =>
        prev.map((dialog) =>
          dialog.id === activeDialogId && dialog.lastMessage?.id === updated.id
            ? { ...dialog, lastMessage: { ...dialog.lastMessage, content: updated.content } }
            : dialog
        )
      )
      setEditingMessageId(null)
      setEditingText("")
    })
  }

  function removeMessage(messageId: number) {
    if (!activeDialogId) {
      return
    }

    startDeleting(async () => {
      const response = await fetch(`/api/chats/${activeDialogId}/messages/${messageId}`, {
        method: "DELETE",
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось удалить сообщение")
        return
      }

      setMessages((prev) => {
        if (!prev) {
          return prev
        }
        const next = prev.filter((item) => item.id !== messageId)
        const nextLast = next[next.length - 1] ?? null

        setDialogs((dialogsPrev) =>
          dialogsPrev.map((dialog) =>
            dialog.id === activeDialogId && dialog.lastMessage?.id === messageId
              ? { ...dialog, lastMessage: nextLast }
              : dialog
          )
        )

        return next
      })
      setEditingMessageId(null)
      setEditingText("")
    })
  }

  const showListPanel = !isDialogView
  const showDialogPanel = isDialogView

  return (
    <main className="h-dvh overflow-hidden bg-gradient-to-b from-background to-muted/20">
      <header className="sticky top-0 z-20 shrink-0 border-b border-border/70 bg-background/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
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
        </div>
      </header>

      <section className="mx-auto flex h-[calc(100dvh-156px)] w-full max-w-5xl min-h-0 px-4 py-4 pb-20">
        <Card className="flex min-h-0 w-full flex-col border-border/80 shadow-xl shadow-black/5">
          <CardHeader className="shrink-0 gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">Чаты</CardTitle>
                <CardDescription>Общайтесь с пользователями из ваших контактов.</CardDescription>
              </div>
              {showListPanel && (
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
              )}
            </div>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col space-y-4">
            {showListPanel && showCreateForm && contacts.length > 0 && (
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

            {showListPanel && (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-border/70 p-2">
                {dialogs.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
                    Чаты отсутствуют. Создайте новый чат с пользователем из контактов.
                  </div>
                )}
                {dialogs.map((dialog) => (
                  <button
                    key={dialog.id}
                    className="w-full rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/50"
                    onClick={() => openDialog(dialog.id)}
                  >
                    <p className="truncate text-sm font-medium">{getDialogTitle(dialog, user.id)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {dialog.lastMessage?.content ?? "Сообщений пока нет"}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {showDialogPanel && (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border/70">
                <div className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {selectedDialog ? getDialogTitle(selectedDialog, user.id) : "Выберите чат"}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setIsDialogView(false)}>
                    <ArrowLeftIcon className="size-4" />
                    Список
                  </Button>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
                  {!activeDialogId && (
                    <p className="text-sm text-muted-foreground">Сначала выберите или создайте чат.</p>
                  )}
                  {activeDialogId && messages === null && (
                    <p className="text-sm text-muted-foreground">Загружаем сообщения...</p>
                  )}
                  {activeDialogId && messages !== null && messages.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Сообщений пока нет. Напишите первое сообщение.
                    </p>
                  )}

                  {messages !== null &&
                    messages.map((message) => {
                      const mine = message.author.id === user.id
                      const isEditingMessage = editingMessageId === message.id
                      return (
                        <div key={message.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                              mine
                                ? "bg-primary/15 text-foreground"
                                : "bg-secondary text-secondary-foreground"
                            }`}
                          >
                            {isEditingMessage ? (
                              <div className="space-y-2">
                                <Input
                                  value={editingText}
                                  onChange={(event) => setEditingText(event.target.value)}
                                  disabled={isEditing}
                                />
                                <div className="flex items-center gap-2">
                                  <Button size="sm" onClick={() => saveEdit(message.id)} disabled={isEditing}>
                                    Сохранить
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingMessageId(null)
                                      setEditingText("")
                                    }}
                                  >
                                    Отмена
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p>{message.content}</p>
                                <p className="mt-1 text-[11px] opacity-70">
                                  {getUserName(message.author)} · {formatTime(message.createdAt)}
                                  {mine && (
                                    <span className="ml-2 inline-flex align-middle">
                                      <MessageStatusIcon status={message.status} />
                                    </span>
                                  )}
                                </p>
                                {mine && (
                                  <div className="mt-2 flex gap-2">
                                    <button
                                      type="button"
                                      className="text-xs underline opacity-80"
                                      onClick={() => beginEdit(message)}
                                    >
                                      Редактировать
                                    </button>
                                    <button
                                      type="button"
                                      className="text-xs underline opacity-80"
                                      onClick={() => removeMessage(message.id)}
                                      disabled={isDeleting}
                                    >
                                      Удалить
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="shrink-0 border-t border-border/70 p-3">
                  <div className="flex items-center gap-2">
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
      </section>

      <BottomNav
        active={isDialogView ? undefined : "chats"}
        onChatsClick={() => {
          setIsDialogView(false)
          setShowCreateForm(false)
          setEditingMessageId(null)
          setEditingText("")
        }}
      />
    </main>
  )
}
