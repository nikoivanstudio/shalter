"use client"

import { ArrowLeftIcon, CheckIcon, EllipsisVerticalIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { LogoutButton } from "@/features/auth/ui/logout-button"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { PushToggle } from "@/features/notifications/ui/push-toggle"
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
  status?: string | null
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
  title: string | null
  users: UserShort[]
  unreadCount: number
  lastMessage: ChatMessage | null
}

export type ChatsHomeProps = {
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

function getDialogTitle(dialog: ChatDialog) {
  const title = dialog.title?.trim()
  if (title) {
    return title
  }

  return "Без названия"
}

function getDialogMembersSubtitle(dialog: ChatDialog, currentUserId: number) {
  const names = dialog.users
    .filter((item) => item.id !== currentUserId)
    .map((item) => getUserName(item))

  if (names.length === 0) {
    return "Только вы"
  }

  return names.join(", ")
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

function normalizeMessageStatus(status: ChatMessage["status"]): "SENT" | "DELIVERED" | "READ" {
  const normalized = status?.toUpperCase()
  if (normalized === "SENT" || normalized === "READ" || normalized === "DELIVERED") {
    return normalized
  }
  return "DELIVERED"
}

function MessageStatusIcon({ status }: { status: ChatMessage["status"] }) {
  const normalized = normalizeMessageStatus(status)
  if (normalized === "SENT") {
    return <CheckIcon className="size-3" />
  }

  const toneClass = normalized === "READ" ? "text-sky-500" : ""
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
    initialDialogId ?? null
  )
  const [isDialogView, setIsDialogView] = useState(Boolean(initialDialogId))
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [messagesReloadKey, setMessagesReloadKey] = useState(0)
  const [sseSince, setSseSince] = useState(0)
  const [messageText, setMessageText] = useState("")
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([])
  const [newChatTitle, setNewChatTitle] = useState("")
  const [openDialogMenuId, setOpenDialogMenuId] = useState<number | null>(null)
  const [isCreating, startCreating] = useTransition()
  const [isSending, startSending] = useTransition()
  const [isEditing, startEditing] = useTransition()
  const [isDeleting, startDeleting] = useTransition()
  const [isDeletingDialog, startDeletingDialog] = useTransition()
  const emblem = buildEmblem(user.firstName, user.lastName)
  const unreadDialogsCount = useMemo(
    () => dialogs.filter((dialog) => dialog.unreadCount > 0).length,
    [dialogs]
  )

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
    if (!isDialogView || !activeDialogId) {
      return
    }

    const controller = new AbortController()
    fetch(`/api/chats/${activeDialogId}/messages`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 404) {
            const error = new Error("CHAT_DELETED")
            ;(error as Error & { code?: string }).code = "CHAT_DELETED"
            throw error
          }
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
          const code = (error as Error & { code?: string }).code
          if (code === "CHAT_DELETED") {
            setDialogs((prev) => prev.filter((item) => item.id !== activeDialogId))
            setIsDialogView(false)
            setSelectedDialogId(null)
            setMessages([])
            setSseSince(0)
            toast.error("Чат удалён владельцем")
            return
          }

          toast.error(error.message)
          setMessages([])
        }
      })

    return () => controller.abort()
  }, [activeDialogId, isDialogView, messagesReloadKey])

  useEffect(() => {
    if (!isDialogView || !activeDialogId || !isMessageListReady) {
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
      setDialogs((prev) => {
        const updated = withUpdatedDialogMessage(prev, nextMessage)
        if (nextMessage.author.id === user.id || isDialogView) {
          return updated
        }

        return updated.map((dialog) =>
          dialog.id === nextMessage.dialogId
            ? { ...dialog, unreadCount: dialog.unreadCount + 1 }
            : dialog
        )
      })
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

    eventSource.addEventListener("chat-deleted", () => {
      setDialogs((prev) => prev.filter((item) => item.id !== activeDialogId))
      setIsDialogView(false)
      setSelectedDialogId(null)
      setMessages([])
      setSseSince(0)
      toast.error("Чат удалён владельцем")
      eventSource.close()
    })

    return () => eventSource.close()
  }, [activeDialogId, isDialogView, isMessageListReady, sseSince, user.id])

  useEffect(() => {
    const eventSource = new EventSource("/api/chats/unread/events")

    eventSource.addEventListener("unread", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        unreadByDialog?: Record<string, number>
      }
      const unreadByDialog = payload.unreadByDialog ?? {}

      setDialogs((prev) =>
        prev.map((dialog) => ({
          ...dialog,
          unreadCount: unreadByDialog[String(dialog.id)] ?? 0,
        }))
      )
    })

    eventSource.addEventListener("chat-error", () => {
      // Keep UI functional even if unread stream has temporary issues.
    })

    return () => eventSource.close()
  }, [])

  useEffect(() => {
    if (!isDialogView || !activeDialogId || !messages || messages.length === 0) {
      return
    }

    const unreadIncomingIds = messages
      .filter(
        (message) =>
          message.author.id !== user.id && normalizeMessageStatus(message.status) !== "READ"
      )
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
            dialog.id === activeDialogId
              ? {
                  ...dialog,
                  unreadCount: 0,
                  lastMessage:
                    dialog.lastMessage && readSet.has(dialog.lastMessage.id)
                      ? { ...dialog.lastMessage, status: "READ" }
                      : dialog.lastMessage,
                }
              : dialog
          )
        )
      })
      .catch(() => null)
  }, [activeDialogId, isDialogView, messages, user.id])

  useEffect(() => {
    if (!isMessageListReady || !isDialogView) {
      return
    }

    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    })
  }, [activeDialogId, isDialogView, isMessageListReady, messages])

  function openDialog(dialogId: number) {
    setOpenDialogMenuId(null)
    setDialogs((prev) =>
      prev.map((dialog) =>
        dialog.id === dialogId ? { ...dialog, unreadCount: 0 } : dialog
      )
    )
    setSelectedDialogId(dialogId)
    setMessages(null)
    setMessagesReloadKey((prev) => prev + 1)
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

    const isGroupChat = selectedContactIds.length >= 2
    if (isGroupChat && !newChatTitle.trim()) {
      toast.error("Для группового чата укажите название")
      return
    }

    startCreating(async () => {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantIds: selectedContactIds,
          title: newChatTitle.trim(),
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось создать чат")
        return
      }

      if (data?.existing && typeof data.dialogId === "number") {
        openDialog(data.dialogId)
        setShowCreateForm(false)
        setSelectedContactIds([])
        setNewChatTitle("")
        return
      }

      const dialog = data.dialog as ChatDialog
      setDialogs((prev) => [{ ...dialog, unreadCount: 0 }, ...prev])
      setSelectedContactIds([])
      setNewChatTitle("")
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

  function removeDialog(dialogId: number) {
    setOpenDialogMenuId(null)
    startDeletingDialog(async () => {
      const response = await fetch(`/api/chats/${dialogId}`, {
        method: "DELETE",
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось удалить чат")
        return
      }

      setDialogs((prev) => prev.filter((item) => item.id !== dialogId))
      if (activeDialogId === dialogId) {
        setIsDialogView(false)
        setSelectedDialogId(null)
        setMessages([])
        setSseSince(0)
      }
      toast.success("Чат удалён")
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
            <PushToggle />
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto flex h-[calc(100dvh-72px)] w-full max-w-5xl min-h-0 px-4 py-4 pb-20">
        <Card className="flex min-h-0 w-full flex-col border-border/80 shadow-xl shadow-black/5">
          {showListPanel && (
            <CardHeader className="shrink-0 gap-3">
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
          )}

          <CardContent className={`flex min-h-0 flex-1 flex-col ${showDialogPanel ? "p-0" : "space-y-4"}`}>
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
                {selectedContactIds.length >= 2 && (
                  <Input
                    value={newChatTitle}
                    onChange={(event) => setNewChatTitle(event.target.value)}
                    placeholder="Название группового чата"
                  />
                )}
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
                  <div key={dialog.id} className="flex items-start gap-2 rounded-lg border border-transparent p-1">
                    <button
                      className="relative w-full rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/50"
                      onClick={() => openDialog(dialog.id)}
                    >
                      {dialog.unreadCount > 0 && (
                        <span className="absolute right-3 top-3 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                          {dialog.unreadCount > 99 ? "99+" : dialog.unreadCount}
                        </span>
                      )}
                      <p className="truncate text-sm font-medium">{getDialogTitle(dialog)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {dialog.lastMessage?.content ?? "Сообщений пока нет"}
                      </p>
                    </button>

                    {dialog.ownerId === user.id && (
                      <div className="relative mt-2">
                        <button
                          type="button"
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground hover:bg-muted"
                          aria-label="Действия с чатом"
                          onClick={() =>
                            setOpenDialogMenuId((prev) => (prev === dialog.id ? null : dialog.id))
                          }
                        >
                          <EllipsisVerticalIcon className="size-4" />
                        </button>
                        {openDialogMenuId === dialog.id && (
                          <div className="absolute right-0 top-9 z-20 min-w-40 rounded-md border border-border bg-popover p-1 shadow-md">
                            <button
                              type="button"
                              className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => removeDialog(dialog.id)}
                              disabled={isDeletingDialog}
                            >
                              Удалить чат
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {showDialogPanel && (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border/70">
                <div className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {selectedDialog ? getDialogTitle(selectedDialog) : "Выберите чат"}
                    </p>
                    {selectedDialog && (
                      <p className="truncate text-xs text-muted-foreground">
                        {getDialogMembersSubtitle(selectedDialog, user.id)}
                      </p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setIsDialogView(false)}>
                    <ArrowLeftIcon className="size-4" />
                    Список
                  </Button>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 pb-24">
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
                          <div className="flex items-start gap-2">
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
                                </>
                              )}
                            </div>
                            {mine && !isEditingMessage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  className="inline-flex size-7 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground hover:bg-muted"
                                  aria-label="Действия с сообщением"
                                >
                                  <EllipsisVerticalIcon className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => beginEdit(message)}>
                                    Редактировать
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => removeMessage(message.id)}
                                    disabled={isDeleting}
                                  >
                                    Удалить
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="sticky bottom-0 shrink-0 border-t border-border/70 bg-background p-3">
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
        chatsBadgeCount={unreadDialogsCount}
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
