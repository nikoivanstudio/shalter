"use client"

import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  FileImageIcon,
  PhoneCallIcon,
  VideoIcon,
  XIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { AccountStatusBadge } from "@/components/ui/account-status-badge"
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
import { ChatCallOverlay } from "@/features/calls/ui/chat-call-overlay"
import { useI18n } from "@/features/i18n/model/i18n-provider"
import { LanguageToggle } from "@/features/i18n/ui/language-toggle"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { PushToggle } from "@/features/notifications/ui/push-toggle"
import {
  getDialogDisplayTitle,
  getDialogUserName,
} from "@/features/chats/lib/dialog-title"
import { buildEmblem, getEmblemTone } from "@/features/profile/lib/emblem"
import { ThemeToggle } from "@/features/theme/ui/theme-toggle"
import type { MediaAttachment, MediaKind } from "@/shared/lib/media/constants"
import { CountryFlagBadge } from "@/shared/ui/country-flag-badge"
import { MessageAttachmentView } from "@/shared/ui/message-attachment-view"

type UserShort = {
  id: number
  firstName: string
  lastName: string | null
  email: string
  role: string
  phone?: string | null
  avatarTone?: string | null
  avatarUrl?: string | null
  isBlocked?: boolean
  lastSeenAt?: string | null
  isOnline?: boolean
}

type ContactUser = {
  id: number
  firstName: string
  lastName: string | null
  email: string
  phone: string
  role: string
  avatarTone?: string | null
  avatarUrl?: string | null
  isBlocked?: boolean
}

type ChatMessage = {
  id: number
  content: string
  status?: string | null
  createdAt: string
  dialogId: number
  attachment?: MediaAttachment | null
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
  initialCallMode?: "audio" | "video" | null
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getDialogMembersSubtitle(dialog: ChatDialog, currentUserId: number) {
  if (dialog.users.length === 2) {
    const otherUser = dialog.users.find((item) => item.id !== currentUserId)
    if (otherUser) {
      return getUserPresenceLabel(otherUser)
    }
  }

  const names = dialog.users
    .filter((item) => item.id !== currentUserId)
    .map((item) => getDialogUserName(item))

  if (names.length === 0) {
    return "Только вы"
  }

  return names.join(", ")
}

function formatLastSeen(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getUserPresenceLabel(user: UserShort) {
  if (user.isOnline) {
    return "Онлайн"
  }

  if (user.lastSeenAt) {
    return `Был(а) в сети ${formatLastSeen(user.lastSeenAt)}`
  }

  return "Статус неизвестен"
}

function OnlineDot() {
  return <span className="inline-block size-2 rounded-full bg-green-500 align-middle" />
}

function PresenceLabel({ user, className = "" }: { user: UserShort; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`.trim()}>
      {user.isOnline ? <OnlineDot /> : null}
      <span className="truncate">{getUserPresenceLabel(user)}</span>
    </span>
  )
}

function getDirectDialogOtherUser(dialog: ChatDialog, currentUserId: number) {
  if (dialog.users.length !== 2) {
    return null
  }

  return dialog.users.find((item) => item.id !== currentUserId) ?? null
}

function isGroupDialog(dialog: ChatDialog) {
  return Boolean(dialog.title?.trim()) || dialog.users.length > 2
}

function canLeaveDialog(dialog: ChatDialog, currentUserId: number) {
  return dialog.users.length > 2 && dialog.users.some((item) => item.id === currentUserId)
}

function canDeleteDialog(dialog: ChatDialog, currentUserId: number) {
  if (dialog.users.length === 2) {
    return dialog.users.some((item) => item.id === currentUserId)
  }

  return dialog.ownerId === currentUserId
}

function canManageDialogParticipants(dialog: ChatDialog, currentUserId: number) {
  return dialog.ownerId === currentUserId && isGroupDialog(dialog)
}

function canRemoveParticipant(
  dialog: ChatDialog,
  currentUserId: number,
  participantId: number
) {
  return (
    canManageDialogParticipants(dialog, currentUserId) &&
    participantId !== currentUserId &&
    participantId !== dialog.ownerId
  )
}

function getAvailableContactsForDialog(dialog: ChatDialog, contacts: ContactUser[]) {
  const participantIds = new Set(dialog.users.map((item) => item.id))
  return contacts.filter((contact) => !participantIds.has(contact.id))
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

function parseEventPayload<T>(event: Event) {
  try {
    return JSON.parse((event as MessageEvent<string>).data) as T
  } catch {
    return null
  }
}

export function ChatsHome({
  user,
  dialogs: initialDialogs,
  contacts,
  initialDialogId,
  initialCallMode = null,
}: ChatsHomeProps) {
  const router = useRouter()
  const { tr } = useI18n()
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const lastDialogResyncAtRef = useRef(0)
  const [dialogs, setDialogs] = useState(initialDialogs)
  const [selectedDialogId, setSelectedDialogId] = useState<number | null>(
    initialDialogId ?? null
  )
  const [isDialogView, setIsDialogView] = useState(Boolean(initialDialogId))
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [messagesReloadKey, setMessagesReloadKey] = useState(0)
  const [sseSince, setSseSince] = useState(0)
  const [messageText, setMessageText] = useState("")
  const [attachmentKind, setAttachmentKind] = useState<MediaKind | null>(null)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([])
  const [newChatTitle, setNewChatTitle] = useState("")
  const [openDialogMenuId, setOpenDialogMenuId] = useState<number | null>(null)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showAddParticipants, setShowAddParticipants] = useState(false)
  const [selectedParticipantIdsToAdd, setSelectedParticipantIdsToAdd] = useState<number[]>([])
  const [isCreating, startCreating] = useTransition()
  const [isSending, startSending] = useTransition()
  const [isEditing, startEditing] = useTransition()
  const [isDeleting, startDeleting] = useTransition()
  const [isDeletingDialog, startDeletingDialog] = useTransition()
  const [isLeavingDialog, startLeavingDialog] = useTransition()
  const [isAddingParticipants, startAddingParticipants] = useTransition()
  const [isRemovingParticipant, startRemovingParticipant] = useTransition()
  const dialogsRef = useRef(initialDialogs)
  const activeDialogIdRef = useRef<number | null>(initialDialogId ?? null)
  const emblem = buildEmblem(user.firstName, user.lastName)
  const emblemTone = getEmblemTone(user.firstName, user.lastName, user.avatarTone)
  const unreadDialogsCount = useMemo(
    () => dialogs.filter((dialog) => dialog.unreadCount > 0).length,
    [dialogs]
  )
  const orderedDialogs = useMemo(() => {
    return [...dialogs].sort((left, right) => {
      const leftHasUnread = left.unreadCount > 0 ? 1 : 0
      const rightHasUnread = right.unreadCount > 0 ? 1 : 0
      return rightHasUnread - leftHasUnread
    })
  }, [dialogs])

  const requestDialogResync = useCallback(() => {
    const now = Date.now()
    if (now - lastDialogResyncAtRef.current < 2000) {
      return
    }

    lastDialogResyncAtRef.current = now
    setMessagesReloadKey((value) => value + 1)
  }, [])

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
  const selectedDialogAvailableContacts = useMemo(
    () => (selectedDialog ? getAvailableContactsForDialog(selectedDialog, contacts) : []),
    [contacts, selectedDialog]
  )
  const isMessageListReady = messages !== null

  function startDialogCall(media: "audio" | "video") {
    if (!activeDialogId) {
      return
    }

    router.replace(`/chats?dialogId=${activeDialogId}&startCall=${media}`)
  }

  function resetComposer() {
    setMessageText("")
    setAttachmentKind(null)
    setAttachmentFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function selectAttachment(kind: MediaKind, file: File | null) {
    setAttachmentKind(file ? kind : null)
    setAttachmentFile(file)
  }

  useEffect(() => {
    dialogsRef.current = dialogs
  }, [dialogs])

  useEffect(() => {
    activeDialogIdRef.current = activeDialogId
  }, [activeDialogId])

  const handleDialogAccessLost = useCallback(
    (dialogId: number, reason: "deleted" | "removed") => {
      const hadDialog = dialogsRef.current.some((item) => item.id === dialogId)
      setDialogs((prev) => prev.filter((item) => item.id !== dialogId))

      if (!hadDialog) {
        return
      }

      if (activeDialogIdRef.current === dialogId) {
        setIsDialogView(false)
        setSelectedDialogId(null)
        setMessages([])
        setSseSince(0)
        setShowParticipants(false)
        setShowAddParticipants(false)
        setSelectedParticipantIdsToAdd([])
      }

      toast.error(tr(reason === "removed" ? "Вас удалили из чата" : "Чат удалён владельцем"))
    },
    [tr]
  )

  useEffect(() => {
    if (!isDialogView || !activeDialogId) {
      return
    }

    const controller = new AbortController()
    fetch(`/api/chats/${activeDialogId}/messages`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          if (response.status === 404) {
            const code = data?.code === "REMOVED_FROM_CHAT" ? "REMOVED_FROM_CHAT" : "CHAT_DELETED"
            const error = new Error(data?.message ?? "Не удалось получить сообщения")
            ;(error as Error & { code?: string }).code = code
            throw error
          }
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
            handleDialogAccessLost(activeDialogId, "deleted")
            return
          }

          if (code === "REMOVED_FROM_CHAT") {
            handleDialogAccessLost(activeDialogId, "removed")
            return
          }

          toast.error(error.message)
          setMessages([])
        }
      })

    return () => controller.abort()
  }, [activeDialogId, handleDialogAccessLost, isDialogView, messagesReloadKey])

  useEffect(() => {
    if (!isDialogView || !activeDialogId || !isMessageListReady) {
      return
    }

    const eventSource = new EventSource(`/api/chats/${activeDialogId}/events?since=${sseSince}`)
    eventSource.addEventListener("message", (event) => {
      const nextMessage = parseEventPayload<ChatMessage>(event)
      if (!nextMessage) {
        return
      }

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
      const payload = parseEventPayload<{ message?: string }>(event)
      eventSource.close()
      requestDialogResync()
      if (!messages?.length) {
        toast.error(payload?.message ?? "Ошибка обновления чата")
      }
    })

    eventSource.addEventListener("status", (event) => {
      const payload = parseEventPayload<{
        id: number
        status: ChatMessage["status"]
      }>(event)
      if (!payload) {
        return
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
      handleDialogAccessLost(activeDialogId, "deleted")
      eventSource.close()
    })

    eventSource.addEventListener("chat-removed", () => {
      handleDialogAccessLost(activeDialogId, "removed")
      eventSource.close()
    })

    eventSource.onerror = () => {
      eventSource.close()
      requestDialogResync()
    }

    return () => eventSource.close()
  }, [
    activeDialogId,
    handleDialogAccessLost,
    isDialogView,
    isMessageListReady,
    messages,
    requestDialogResync,
    sseSince,
    user.id,
  ])

  useEffect(() => {
    if (!isDialogView || !activeDialogId) {
      return
    }

    void fetch(`/api/chats/${activeDialogId}/messages/read`, { method: "POST" }).catch(() => null)
  }, [activeDialogId, isDialogView])

  useEffect(() => {
    const eventSource = new EventSource("/api/chats/unread/events")

    eventSource.addEventListener("unread", (event) => {
      const payload = parseEventPayload<{
        dialogIds?: number[]
        presenceByUserId?: Record<string, { lastSeenAt: string | null; isOnline: boolean }>
        unreadByDialog?: Record<string, number>
      }>(event)
      if (!payload) {
        return
      }

      const unreadByDialog = payload.unreadByDialog ?? {}
      const presenceByUserId = payload.presenceByUserId ?? {}
      const hasDialogIds = Array.isArray(payload.dialogIds)
      const allowedDialogIds = new Set(payload.dialogIds ?? [])

      setDialogs((prev) =>
        prev
          .filter((dialog) => !hasDialogIds || allowedDialogIds.has(dialog.id))
          .map((dialog) => ({
            ...dialog,
            users: dialog.users.map((dialogUser) => {
              const presence = presenceByUserId[String(dialogUser.id)]
              return presence
                ? {
                    ...dialogUser,
                    lastSeenAt: presence.lastSeenAt,
                    isOnline: presence.isOnline,
                  }
                : dialogUser
            }),
            unreadCount: unreadByDialog[String(dialog.id)] ?? 0,
          }))
      )
    })

    eventSource.addEventListener("chat-deleted", (event) => {
      const payload = parseEventPayload<{ dialogId?: number }>(event)
      if (typeof payload?.dialogId === "number") {
        handleDialogAccessLost(payload.dialogId, "deleted")
      }
    })

    eventSource.addEventListener("chat-removed", (event) => {
      const payload = parseEventPayload<{ dialogId?: number }>(event)
      if (typeof payload?.dialogId === "number") {
        handleDialogAccessLost(payload.dialogId, "removed")
      }
    })

    eventSource.addEventListener("chat-error", () => {
      // Keep UI functional even if unread stream has temporary issues.
    })

    return () => eventSource.close()
  }, [handleDialogAccessLost])

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
    setShowParticipants(false)
    setShowAddParticipants(false)
    setSelectedParticipantIdsToAdd([])
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

  function toggleParticipantToAdd(contactId: number) {
    setSelectedParticipantIdsToAdd((prev) =>
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
    if (!content && !attachmentFile) {
      return
    }

    startSending(async () => {
      const body =
        attachmentFile && attachmentKind
          ? (() => {
              const formData = new FormData()
              formData.set("content", content)
              formData.set("kind", attachmentKind)
              formData.set("attachment", attachmentFile)
              return formData
            })()
          : JSON.stringify({ content })

      const response = await fetch(`/api/chats/${activeDialogId}/messages`, {
        method: "POST",
        ...(body instanceof FormData
          ? { body }
          : {
              headers: { "Content-Type": "application/json" },
              body,
            }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось отправить сообщение")
        return
      }

      const nextMessage = data.message as ChatMessage
      resetComposer()
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
        setShowParticipants(false)
      }
      toast.success("Чат удалён")
    })
  }

  function leaveDialog(dialogId: number) {
    setOpenDialogMenuId(null)
    startLeavingDialog(async () => {
      const response = await fetch(`/api/chats/${dialogId}/leave`, {
        method: "POST",
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось покинуть чат")
        return
      }

      setDialogs((prev) => prev.filter((item) => item.id !== dialogId))
      if (activeDialogId === dialogId) {
        setIsDialogView(false)
        setSelectedDialogId(null)
        setMessages([])
        setSseSince(0)
        setShowParticipants(false)
      }
      toast.success("Вы покинули чат")
    })
  }

  function addParticipants(dialogId: number) {
    if (selectedParticipantIdsToAdd.length === 0) {
      toast.error("Выберите хотя бы одного пользователя")
      return
    }

    startAddingParticipants(async () => {
      const response = await fetch(`/api/chats/${dialogId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantIds: selectedParticipantIdsToAdd }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось добавить участников")
        return
      }

      const nextMessage = data?.message as ChatMessage | undefined
      const users = Array.isArray(data?.users) ? (data.users as UserShort[]) : []

      setDialogs((prev) =>
        prev.map((dialog) =>
          dialog.id === dialogId
            ? {
                ...dialog,
                users: [...dialog.users, ...users],
                lastMessage: nextMessage ?? dialog.lastMessage,
              }
            : dialog
        )
      )

      if (nextMessage) {
        setMessages((prev) => {
          if (!prev) {
            return [nextMessage]
          }
          if (prev.some((item) => item.id === nextMessage.id)) {
            return prev
          }
          return [...prev, nextMessage]
        })
      }

      setShowParticipants(true)
      setShowAddParticipants(false)
      setSelectedParticipantIdsToAdd([])
      toast.success("Участники добавлены")
    })
  }

  function removeParticipant(dialogId: number, participantId: number) {
    startRemovingParticipant(async () => {
      const response = await fetch(`/api/chats/${dialogId}/participants`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: participantId }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось удалить участника")
        return
      }

      const nextMessage = data?.message as ChatMessage | undefined

      setDialogs((prev) =>
        prev.map((dialog) =>
          dialog.id === dialogId
            ? {
                ...dialog,
                users: dialog.users.filter((item) => item.id !== participantId),
                lastMessage: nextMessage ?? dialog.lastMessage,
              }
            : dialog
        )
      )

      if (nextMessage) {
        setMessages((prev) => {
          if (!prev) {
            return [nextMessage]
          }
          if (prev.some((item) => item.id === nextMessage.id)) {
            return prev
          }
          return [...prev, nextMessage]
        })
      }

      setSelectedParticipantIdsToAdd((prev) => prev.filter((id) => id !== participantId))
      toast.success("Участник удалён")
    })
  }

  const showListPanel = !isDialogView
  const showDialogPanel = isDialogView

  return (
    <main className="h-dvh overflow-hidden px-3 py-4 sm:px-6 sm:py-5">
      <header className="sticky top-0 z-20 shrink-0 rounded-[1.7rem] border border-white/50 bg-card/88 px-4 py-3 shadow-[0_20px_55px_-32px_rgba(15,23,42,0.48)] backdrop-blur-xl dark:border-white/8 sm:rounded-[2rem] sm:px-5 sm:py-4">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-14 items-center justify-center rounded-full border border-white/55 text-sm font-semibold shadow-lg shadow-sky-500/10 ${emblemTone}`}
            >
              {emblem}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-lg font-semibold">{getDialogUserName(user)}</p>
                <CountryFlagBadge phone={user.phone} />
                <AccountStatusBadge
                  role={user.role}
                  email={user.email}
                  firstName={user.firstName}
                  lastName={user.lastName}
                  isBlocked={user.isBlocked}
                />
              </div>
              <p className="truncate text-sm text-muted-foreground">Личные и групповые диалоги</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PushToggle />
            <LanguageToggle />
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto flex h-[calc(100dvh-144px)] w-full max-w-5xl min-h-0 py-3 pb-20 sm:h-[calc(100dvh-116px)] sm:py-4">
        <Card className="flex min-h-0 w-full flex-col border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
          {showListPanel && (
            <CardHeader className="shrink-0 gap-3 border-b border-border/55 pb-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl font-semibold tracking-tight">{tr("Чаты")}</CardTitle>
                  <CardDescription>{tr("Общайтесь с пользователями из ваших контактов.")}</CardDescription>
                </div>
                <div className="space-y-1">
                  <Button
                    onClick={() => setShowCreateForm((prev) => !prev)}
                    disabled={contacts.length === 0}
                  >
                    {tr("Создать чат")}
                  </Button>
                  {contacts.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {tr("Чтобы создать чат, сначала добавьте контакты.")}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
          )}

          <CardContent
            className={`flex min-h-0 flex-1 flex-col pt-6 ${showDialogPanel ? "p-0 pt-0" : "space-y-4"}`}
          >
            {showListPanel && showCreateForm && contacts.length > 0 && (
              <div className="space-y-3 rounded-[1.6rem] border border-border/70 bg-background/78 p-4 shadow-sm">
                <p className="text-sm font-medium">Выберите пользователей для нового чата</p>
                <div className="grid max-h-[28dvh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
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
                      <span className="truncate">{getDialogUserName(contact)}</span>
                      <CountryFlagBadge phone={contact.phone} />
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
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-[1.75rem] border border-border/70 bg-background/74 p-2.5 shadow-sm">
                {orderedDialogs.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
                    {tr("Чаты отсутствуют. Создайте новый чат с пользователем из контактов.")}
                  </div>
                )}
                {orderedDialogs.map((dialog) => (
                  <div key={dialog.id} className="flex items-start gap-2 rounded-[1.2rem] border border-transparent p-1">
                    <button
                      className="relative w-full rounded-[1.3rem] border border-border/60 bg-background/88 p-3.5 text-left transition-colors hover:bg-accent/45"
                      onClick={() => openDialog(dialog.id)}
                    >
                      {dialog.unreadCount > 0 && (
                        <span className="absolute right-3 top-3 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                          {dialog.unreadCount > 99 ? "99+" : dialog.unreadCount}
                        </span>
                      )}
                      <p className="truncate text-sm font-medium">
                        {getDialogDisplayTitle(dialog, user.id)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {dialog.lastMessage?.content ?? "Сообщений пока нет"}
                      </p>
                    </button>

                    {(canDeleteDialog(dialog, user.id) || canLeaveDialog(dialog, user.id)) && (
                      <div className="relative mt-2">
                        <button
                          type="button"
                          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted-foreground hover:bg-accent"
                          aria-label="Действия с чатом"
                          onClick={() =>
                            setOpenDialogMenuId((prev) => (prev === dialog.id ? null : dialog.id))
                          }
                        >
                          <EllipsisVerticalIcon className="size-4" />
                        </button>
                        {openDialogMenuId === dialog.id && (
                          <div className="absolute right-0 top-11 z-20 min-w-40 rounded-2xl border border-border bg-popover/96 p-1.5 shadow-xl backdrop-blur-xl">
                            {canLeaveDialog(dialog, user.id) && (
                              <button
                                type="button"
                                className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => leaveDialog(dialog.id)}
                                disabled={isLeavingDialog}
                              >
                                Покинуть группу
                              </button>
                            )}
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
              <div className="flex min-h-0 flex-1 flex-col rounded-[1.75rem] border border-border/70 bg-background/68">
                <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-background/72 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {selectedDialog
                        ? getDialogDisplayTitle(selectedDialog, user.id)
                        : tr("Выберите чат")}
                    </p>
                    {selectedDialog &&
                      (() => {
                        const otherUser = getDirectDialogOtherUser(selectedDialog, user.id)

                        if (otherUser) {
                          return (
                            <div className="text-xs text-muted-foreground">
                              <PresenceLabel user={otherUser} />
                            </div>
                          )
                        }

                        return (
                          <p className="truncate text-xs text-muted-foreground">
                            {getDialogMembersSubtitle(selectedDialog, user.id)}
                          </p>
                        )
                      })()}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {selectedDialog && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startDialogCall("audio")}
                        >
                          <PhoneCallIcon className="size-4" />
                          Аудио
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startDialogCall("video")}
                        >
                          <VideoIcon className="size-4" />
                          Видео
                        </Button>
                      </>
                    )}
                    {selectedDialog && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowParticipants((prev) => !prev)}
                      >
                        {showParticipants ? tr("Скрыть участников") : tr("Участники")}
                      </Button>
                    )}
                    {selectedDialog &&
                      (canDeleteDialog(selectedDialog, user.id) ||
                        canLeaveDialog(selectedDialog, user.id)) && (
                        <div className="relative">
                          <button
                            type="button"
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted-foreground hover:bg-accent"
                            aria-label="Действия с чатом"
                            onClick={() =>
                              setOpenDialogMenuId((prev) =>
                                prev === selectedDialog.id ? null : selectedDialog.id
                              )
                            }
                          >
                            <EllipsisVerticalIcon className="size-4" />
                          </button>
                          {openDialogMenuId === selectedDialog.id && (
                            <div className="absolute right-0 top-11 z-20 min-w-52 rounded-2xl border border-border bg-popover/96 p-1.5 shadow-xl backdrop-blur-xl">
                              {canManageDialogParticipants(selectedDialog, user.id) && (
                                <button
                                  type="button"
                                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                                  onClick={() => {
                                    setOpenDialogMenuId(null)
                                    setShowParticipants(true)
                                    setShowAddParticipants((prev) => !prev)
                                  }}
                                >
                                  Добавить участников
                                </button>
                              )}
                              {canLeaveDialog(selectedDialog, user.id) && (
                                <button
                                  type="button"
                                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                                  onClick={() => leaveDialog(selectedDialog.id)}
                                  disabled={isLeavingDialog}
                                >
                                  Покинуть группу
                                </button>
                              )}
                              {canDeleteDialog(selectedDialog, user.id) && (
                                <button
                                  type="button"
                                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                                  onClick={() => removeDialog(selectedDialog.id)}
                                  disabled={isDeletingDialog}
                                >
                                  Удалить чат
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setIsDialogView(false)}
                    >
                      <ArrowLeftIcon className="size-4" />
                      {tr("Список")}
                    </Button>
                  </div>
                </div>
                {selectedDialog && showParticipants && (
                  <div className="max-h-[45dvh] shrink-0 overflow-y-auto border-b border-border/70 bg-muted/28 px-4 py-3">
                    <div className="space-y-2">
                      {canManageDialogParticipants(selectedDialog, user.id) && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">Управление участниками</p>
                            <p className="text-xs text-muted-foreground">
                              Только админ чата может добавлять и удалять участников.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={showAddParticipants ? "secondary" : "outline"}
                            onClick={() => {
                              setShowAddParticipants((prev) => !prev)
                              if (showAddParticipants) {
                                setSelectedParticipantIdsToAdd([])
                              }
                            }}
                          >
                            {showAddParticipants ? "Скрыть форму" : "Добавить участников"}
                          </Button>
                        </div>
                      )}
                      {canManageDialogParticipants(selectedDialog, user.id) && showAddParticipants && (
                        <div className="space-y-3 rounded-[1.35rem] border border-border/70 bg-background/86 px-3 py-3">
                          <div>
                            <p className="text-sm font-medium">Добавить участников</p>
                            <p className="text-xs text-muted-foreground">
                              Доступны только пользователи из ваших контактов.
                            </p>
                          </div>
                          {selectedDialogAvailableContacts.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Нет доступных контактов для добавления.
                            </p>
                          ) : (
                            <>
                              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                                {selectedDialogAvailableContacts.map((contact) => (
                                  <label
                                    key={contact.id}
                                    className="flex cursor-pointer items-center gap-2 rounded-[1.1rem] border border-border/70 bg-background/80 p-2 text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      className="size-4 shrink-0 accent-primary"
                                      checked={selectedParticipantIdsToAdd.includes(contact.id)}
                                      onChange={() => toggleParticipantToAdd(contact.id)}
                                    />
                                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                                      <span className="truncate">{getDialogUserName(contact)}</span>
                                      <CountryFlagBadge phone={contact.phone} />
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
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => addParticipants(selectedDialog.id)}
                                  disabled={
                                    isAddingParticipants || selectedParticipantIdsToAdd.length === 0
                                  }
                                >
                                  {isAddingParticipants ? "Добавляем..." : "Добавить"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setShowAddParticipants(false)
                                    setSelectedParticipantIdsToAdd([])
                                  }}
                                >
                                  Отмена
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      <p className="text-xs font-medium text-muted-foreground">
                        Участники: {selectedDialog.users.length}
                      </p>
                      <div className="space-y-2 pr-1">
                        {selectedDialog.users.map((participant) => {
                          const isCurrentUser = participant.id === user.id
                          const isOwner = participant.id === selectedDialog.ownerId

                          return (
                            <div
                              key={participant.id}
                              className="rounded-[1.2rem] border border-border/70 bg-background/86 px-3 py-2.5"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-medium">
                                      {getDialogUserName(participant)}
                                      {isCurrentUser ? " (Вы)" : ""}
                                      {isOwner ? " • админ" : ""}
                                    </p>
                                    <CountryFlagBadge phone={participant.phone} />
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
                                  <div className="text-xs text-muted-foreground">
                                    <PresenceLabel user={participant} />
                                  </div>
                                </div>
                                {canRemoveParticipant(selectedDialog, user.id, participant.id) && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={isRemovingParticipant}
                                    onClick={() => removeParticipant(selectedDialog.id, participant.id)}
                                  >
                                    Удалить
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {!activeDialogId ? (
                    <p className="text-sm text-muted-foreground">Сначала выберите или создайте чат.</p>
                  ) : null}

                  {activeDialogId && messages === null ? (
                    <p className="text-sm text-muted-foreground">Загружаем сообщения...</p>
                  ) : null}

                  {activeDialogId && messages !== null && messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Сообщений пока нет. Напишите первое сообщение.
                    </p>
                  ) : null}

                  {messages !== null &&
                    messages.map((message) => {
                      const mine = message.author.id === user.id
                      const isEditingMessage = editingMessageId === message.id

                      return (
                        <div
                          key={message.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div className="flex items-start gap-2">
                            <div
                              className={`w-fit max-w-[85%] rounded-[1.35rem] px-3.5 py-2.5 text-sm shadow-sm ${
                                mine
                                  ? "rounded-br-md bg-primary text-primary-foreground"
                                  : "rounded-bl-md border border-white/45 bg-background/96 text-foreground dark:border-white/8"
                              }`}
                            >
                              {isEditingMessage ? (
                                <div className="space-y-2">
                                  <Input
                                    value={editingText}
                                    onChange={(event) => setEditingText(event.target.value)}
                                    disabled={isEditing}
                                  />
                                  <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button
                                      size="sm"
                                      onClick={() => saveEdit(message.id)}
                                      disabled={isEditing}
                                    >
                                      {isEditing ? "Сохраняем..." : "Сохранить"}
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
                                  {message.content ? (
                                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                                  ) : null}
                                  <MessageAttachmentView attachment={message.attachment} compact />
                                  <p className="mt-1 text-[11px] opacity-75">
                                    {!mine ? `${getDialogUserName(message.author)} · ` : null}
                                    {formatTime(message.createdAt)}
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
                                  className="inline-flex size-8 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted-foreground hover:bg-accent"
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

                <div className="sticky bottom-0 shrink-0 border-t border-border/70 bg-background/88 p-3 backdrop-blur-xl">
                  <div className="space-y-2 rounded-[1.85rem] border border-white/45 bg-card/92 p-2.5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.65)] dark:border-white/8">
                    {attachmentFile && attachmentKind ? (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/78 px-3 py-2 text-sm">
                        <span className="min-w-0 truncate">{attachmentFile.name}</span>
                        <Button type="button" size="icon" variant="outline" onClick={resetComposer}>
                          <XIcon className="size-4" />
                        </Button>
                      </div>
                    ) : null}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,*/*"
                      className="hidden"
                      onChange={(event) => selectAttachment("FILE", event.target.files?.[0] ?? null)}
                    />
                    <div className="flex items-end gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!activeDialogId || isSending}
                        aria-label="Отправить файл или картинку"
                      >
                        <FileImageIcon className="size-4" />
                      </Button>
                      <Input
                        value={messageText}
                        onChange={(event) => setMessageText(event.target.value)}
                        className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                        placeholder="Введите сообщение"
                        disabled={!activeDialogId || isSending}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault()
                            sendMessage()
                          }
                        }}
                      />
                      <Button
                        className="min-w-0 rounded-full px-4 sm:min-w-28"
                        onClick={sendMessage}
                        disabled={!activeDialogId || isSending || (!messageText.trim() && !attachmentFile)}
                      >
                        {isSending ? "Отправка..." : "Отправить"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <ChatCallOverlay
        currentUser={{
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          avatarTone: user.avatarTone,
          avatarUrl: user.avatarUrl,
        }}
        selectedDialogId={activeDialogId}
        initialAutoStartCall={initialCallMode}
        dialogs={dialogs.map((dialog) => ({
          id: dialog.id,
          title: dialog.title,
          users: dialog.users.map((dialogUser) => ({
            userId: dialogUser.id,
            firstName: dialogUser.firstName,
            lastName: dialogUser.lastName,
            email: dialogUser.email,
            avatarTone: dialogUser.avatarTone,
            avatarUrl: dialogUser.avatarUrl,
          })),
        }))}
      />

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

