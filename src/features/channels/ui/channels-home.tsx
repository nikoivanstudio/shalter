"use client"

import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  EllipsisVerticalIcon,
  HashIcon,
  PaperclipIcon,
  SearchIcon,
  ShieldIcon,
  StarIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { AccountStatusBadge } from "@/components/ui/account-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { LogoutButton } from "@/features/auth/ui/logout-button"
import {
  ContactProfileCard,
  type ViewedContactProfile,
} from "@/features/contacts/ui/contact-profile-card"
import { useI18n } from "@/features/i18n/model/i18n-provider"
import { LanguageToggle } from "@/features/i18n/ui/language-toggle"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { ThemeToggle } from "@/features/theme/ui/theme-toggle"
import { hasAdministrativeAccess } from "@/shared/lib/auth/roles"
import type { MediaAttachment } from "@/shared/lib/media/constants"
import { CountryFlagBadge } from "@/shared/ui/country-flag-badge"
import { MessageAttachmentView } from "@/shared/ui/message-attachment-view"
import { UserAvatar } from "@/shared/ui/user-avatar"

type UserShort = {
  id: number
  firstName: string
  lastName: string | null
  email: string
  phone?: string | null
  role: string
  avatarTone?: string | null
  avatarUrl?: string | null
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
  avatarTone?: string | null
  avatarUrl?: string | null
}

type ChannelParticipant = UserShort & {
  channelRole: "OWNER" | "ADMIN" | "MEMBER"
}

type ChannelMessage = {
  id: number
  channelId: number
  content: string
  createdAt: string
  attachment?: MediaAttachment | null
  author: {
    id: number
    firstName: string
    lastName: string | null
    avatarTone?: string | null
    avatarUrl?: string | null
  }
}

type ChannelItem = {
  id: number
  title: string
  description: string | null
  avatarUrl?: string | null
  ownerId: number
  myRole: "OWNER" | "ADMIN" | "MEMBER" | null
  participants: ChannelParticipant[]
  lastMessage: ChannelMessage | null
}

type SearchChannel = {
  id: number
  title: string
  description: string | null
  avatarUrl?: string | null
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
  const router = useRouter()
  const { tr } = useI18n()
  const createAvatarInputRef = useRef<HTMLInputElement | null>(null)
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)
  const [channels, setChannels] = useState(initialChannels)
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(initialChannelId)
  const [messages, setMessages] = useState<ChannelMessage[] | null>(null)
  const [createTitle, setCreateTitle] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [createAvatarFile, setCreateAvatarFile] = useState<File | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchChannel[]>([])
  const [messageText, setMessageText] = useState("")
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([])
  const [showMembers, setShowMembers] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<ViewedContactProfile | null>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [isCreating, startCreating] = useTransition()
  const [isSearching, startSearching] = useTransition()
  const [isJoining, startJoining] = useTransition()
  const [isSending, startSending] = useTransition()
  const [isUpdatingRole, startUpdatingRole] = useTransition()
  const [isAddingParticipants, startAddingParticipants] = useTransition()
  const [isRemovingParticipant, startRemovingParticipant] = useTransition()
  const [isDeletingChannel, startDeletingChannel] = useTransition()
  const [isLeavingChannel, startLeavingChannel] = useTransition()
  const [, startEditingMessage] = useTransition()
  const [isDeletingMessage, startDeletingMessage] = useTransition()

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) ?? null,
    [channels, selectedChannelId]
  )
  const myRole = selectedChannel?.myRole ?? null
  const canManage = myRole === "OWNER"
  const canWrite = myRole === "OWNER" || myRole === "ADMIN"
  const canModerateChannels = hasAdministrativeAccess(user.role)
  const canDeleteSelectedChannel = canManage || canModerateChannels
  const availableContacts = useMemo(() => {
    if (!selectedChannel) {
      return []
    }

    const participantIds = new Set(selectedChannel.participants.map((participant) => participant.id))
    return contacts.filter((contact) => !participantIds.has(contact.id))
  }, [contacts, selectedChannel])
  const createAvatarPreviewUrl = useMemo(
    () => (createAvatarFile ? URL.createObjectURL(createAvatarFile) : null),
    [createAvatarFile]
  )

  useEffect(() => {
    if (!createAvatarPreviewUrl) {
      return
    }

    return () => {
      URL.revokeObjectURL(createAvatarPreviewUrl)
    }
  }, [createAvatarPreviewUrl])

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
    setAttachmentFile(null)
    setShowMembers(false)
  }

  function openProfile(contactUserId: number) {
    if (contactUserId === user.id) {
      return
    }

    setSelectedProfile(null)
    setIsProfileLoading(true)

    void fetch(`/api/contacts/${contactUserId}/profile`)
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(tr(data?.message ?? "Не удалось открыть профиль"))
        }

        return data as { profile: ViewedContactProfile }
      })
      .then((data) => {
        setSelectedProfile(data.profile)
      })
      .catch((error: Error) => {
        toast.error(error.message)
      })
      .finally(() => {
        setIsProfileLoading(false)
      })
  }

  function openChatWithCall(contactId: number, media: "audio" | "video") {
    router.push(`/chats?contactId=${contactId}&startCall=${media}`)
  }

  function createChannel() {
    startCreating(async () => {
      const formData = new FormData()
      formData.set(
        "channel",
        JSON.stringify({
          title: createTitle,
          description: createDescription,
        })
      )

      if (createAvatarFile) {
        formData.set("avatarFile", createAvatarFile)
      }

      const response = await fetch("/api/channels", {
        method: "POST",
        body: formData,
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
      setCreateAvatarFile(null)
      if (createAvatarInputRef.current) {
        createAvatarInputRef.current.value = ""
      }
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
      const response = attachmentFile
        ? await fetch(`/api/channels/${selectedChannelId}/messages`, {
            method: "POST",
            body: (() => {
              const formData = new FormData()
              formData.set("content", messageText)
              formData.set("kind", "FILE")
              formData.set("attachment", attachmentFile)
              return formData
            })(),
          })
        : await fetch(`/api/channels/${selectedChannelId}/messages`, {
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
      setAttachmentFile(null)
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = ""
      }
    })
  }

  function beginEditMessage(message: ChannelMessage) {
    const nextContent = window.prompt("Введите новый текст сообщения", message.content)
    if (nextContent === null || nextContent === message.content) {
      return
    }

    saveEditedMessage(message.id, nextContent)
  }

  function saveEditedMessage(messageId: number, nextContent: string) {
    if (!selectedChannelId) {
      return
    }

    startEditingMessage(async () => {
      const response = await fetch(
        `/api/channels/${selectedChannelId}/messages/${messageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: nextContent }),
        }
      )

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось обновить сообщение"))
        return
      }

      const updatedMessage = data.message as ChannelMessage
      setMessages((prev) =>
        prev?.map((message) => (message.id === updatedMessage.id ? updatedMessage : message)) ?? prev
      )
      setChannels((prev) =>
        prev.map((channel) =>
          channel.id === selectedChannelId && channel.lastMessage?.id === updatedMessage.id
            ? { ...channel, lastMessage: updatedMessage }
            : channel
        )
      )
      toast.success(tr("Сообщение обновлено"))
    })
  }

  function deleteMessage(messageId: number) {
    if (!selectedChannelId) {
      return
    }

    startDeletingMessage(async () => {
      const response = await fetch(`/api/channels/${selectedChannelId}/messages/${messageId}`, {
        method: "DELETE",
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось удалить сообщение"))
        return
      }

      setMessages((prev) => {
        const next = prev?.filter((message) => message.id !== messageId) ?? prev
        setChannels((channelsPrev) =>
          channelsPrev.map((channel) =>
            channel.id === selectedChannelId && channel.lastMessage?.id === messageId
              ? { ...channel, lastMessage: next?.at(-1) ?? null }
              : channel
          )
        )
        return next
      })
      toast.success(tr("Сообщение удалено"))
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

  function removeParticipant(targetUserId: number) {
    if (!selectedChannelId) {
      return
    }

    const confirmed = window.confirm("Выгнать участника из канала?")
    if (!confirmed) {
      return
    }

    startRemovingParticipant(async () => {
      const response = await fetch(
        `/api/channels/${selectedChannelId}/participants?targetUserId=${targetUserId}`,
        {
          method: "DELETE",
        }
      )
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось выгнать участника"))
        return
      }

      setChannels((prev) =>
        prev.map((channel) =>
          channel.id === selectedChannelId
            ? {
                ...channel,
                participants: channel.participants.filter((participant) => participant.id !== targetUserId),
              }
            : channel
        )
      )
      setSelectedContactIds((prev) => prev.filter((id) => id !== targetUserId))
      toast.success(tr("Участник удалён"))
    })
  }

  function deleteChannel() {
    if (!selectedChannelId || !selectedChannel) {
      return
    }

    const confirmed = window.confirm(`Удалить канал «${selectedChannel.title}»?`)
    if (!confirmed) {
      return
    }

    startDeletingChannel(async () => {
      const response = await fetch(`/api/channels/${selectedChannelId}`, {
        method: "DELETE",
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось удалить канал"))
        return
      }

      setChannels((prev) => {
        const next = prev.filter((channel) => channel.id !== selectedChannelId)
        const nextSelectedId = next[0]?.id ?? null
        setSelectedChannelId(nextSelectedId)
        setMessages(nextSelectedId ? null : [])
        setShowMembers(false)
        return next
      })
      toast.success(tr("Канал удалён"))
    })
  }

  function deleteChannelFromSearch(channelId: number, channelTitle: string) {
    const confirmed = window.confirm(`РЈРґР°Р»РёС‚СЊ РєР°РЅР°Р» В«${channelTitle}В»?`)
    if (!confirmed) {
      return
    }

    startDeletingChannel(async () => {
      const response = await fetch(`/api/channels/${channelId}`, {
        method: "DELETE",
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РєР°РЅР°Р»"))
        return
      }

      setChannels((prev) => {
        const next = prev.filter((channel) => channel.id !== channelId)
        if (selectedChannelId === channelId) {
          const nextSelectedId = next[0]?.id ?? null
          setSelectedChannelId(nextSelectedId)
          setMessages(nextSelectedId ? null : [])
          setShowMembers(false)
        }
        return next
      })
      setSearchResults((prev) => prev.filter((channel) => channel.id !== channelId))
      toast.success(tr("РљР°РЅР°Р» СѓРґР°Р»С‘РЅ"))
    })
  }

  function leaveChannel() {
    if (!selectedChannelId || !selectedChannel) {
      return
    }

    const confirmed = window.confirm(`Покинуть канал «${selectedChannel.title}»?`)
    if (!confirmed) {
      return
    }

    startLeavingChannel(async () => {
      const response = await fetch(`/api/channels/${selectedChannelId}/leave`, {
        method: "POST",
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось покинуть канал"))
        return
      }

      setChannels((prev) => {
        const next = prev.filter((channel) => channel.id !== selectedChannelId)
        const nextSelectedId = next[0]?.id ?? null
        setSelectedChannelId(nextSelectedId)
        setMessages(nextSelectedId ? null : [])
        setShowMembers(false)
        return next
      })
      setSelectedProfile(null)
      setIsProfileLoading(false)
      toast.success(tr("Вы покинули канал"))
    })
  }

  return (
    <main className="min-h-screen px-4 py-5 pb-28 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="rounded-[2rem] border border-white/50 bg-card/88 px-5 py-4 shadow-[0_20px_55px_-32px_rgba(15,23,42,0.48)] backdrop-blur-xl dark:border-white/8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <UserAvatar
                firstName={user.firstName}
                lastName={user.lastName}
                avatarTone={user.avatarTone}
                avatarUrl={user.avatarUrl}
                className="size-14"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-lg font-semibold">
                    {user.firstName} {user.lastName ?? ""}
                  </p>
                  <CountryFlagBadge phone={user.phone} />
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

        <section className="mx-auto flex min-h-0 w-full max-w-6xl">
          <Card className="flex min-h-[78dvh] w-full flex-col border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
            <CardContent className="grid min-h-0 flex-1 gap-0 p-0 lg:grid-cols-[360px_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col border-b border-border/60 p-3 sm:p-4 lg:border-r lg:border-b-0">
                <div className="rounded-[1.5rem] border border-border/70 bg-background/72 p-4 shadow-sm">
                  <p className="text-sm font-medium">{tr("Создать канал")}</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-3 rounded-[1rem] border border-dashed border-border/70 bg-card/60 p-3">
                      <UserAvatar
                        firstName={createTitle || tr("Канал")}
                        lastName={null}
                        avatarUrl={createAvatarPreviewUrl}
                        className="size-12"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-muted-foreground">
                          {createAvatarFile ? createAvatarFile.name : tr("Аватарка канала")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => createAvatarInputRef.current?.click()}
                          >
                            {tr("Выбрать фото")}
                          </Button>
                          {createAvatarFile && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setCreateAvatarFile(null)
                                if (createAvatarInputRef.current) {
                                  createAvatarInputRef.current.value = ""
                                }
                              }}
                            >
                              <XIcon className="size-4" />
                              {tr("Убрать")}
                            </Button>
                          )}
                        </div>
                        <input
                          ref={createAvatarInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          onChange={(event) => setCreateAvatarFile(event.target.files?.[0] ?? null)}
                        />
                      </div>
                    </div>
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
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
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
                          <div className="flex min-w-0 gap-3">
                            <UserAvatar
                              firstName={channel.title}
                              lastName={null}
                              avatarUrl={channel.avatarUrl}
                              className="size-11 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{channel.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {channel.description || tr("Без описания")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {tr("Участников:")} {channel.memberCount}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                            {channel.joined ? (
                            <Button size="sm" variant="outline" onClick={() => openChannel(channel.id)}>
                              {tr("Открыть")}
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => joinChannel(channel.id)} disabled={isJoining}>
                              {tr("Вступить")}
                            </Button>
                            )}
                            {(canModerateChannels || channel.ownerId === user.id) ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={isDeletingChannel}
                                onClick={() => deleteChannelFromSearch(channel.id, channel.title)}
                              >
                                {tr("РЈРґР°Р»РёС‚СЊ")}
                              </Button>
                            ) : null}
                          </div>
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
                        className={`flex w-full items-start gap-3 rounded-[1.25rem] border p-3 text-left transition-colors ${
                          selectedChannelId === channel.id
                            ? "border-primary/70 bg-primary/10"
                            : "border-border/70 bg-background/82 hover:bg-accent/40"
                        }`}
                        onClick={() => openChannel(channel.id)}
                      >
                        <UserAvatar
                          firstName={channel.title}
                          lastName={null}
                          avatarUrl={channel.avatarUrl}
                          className="size-11 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{channel.title}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {channel.lastMessage?.content ?? channel.description ?? tr("Сообщений пока нет")}
                          </p>
                        </div>
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
                <div className="flex flex-col gap-3 border-b border-border/60 bg-background/72 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {selectedChannel ? (
                      <UserAvatar
                        firstName={selectedChannel.title}
                        lastName={null}
                        avatarUrl={selectedChannel.avatarUrl}
                        className="size-12 shrink-0"
                      />
                    ) : (
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/70">
                        <HashIcon className="size-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold">
                        <HashIcon className="size-4" />
                        {selectedChannel?.title ?? tr("Канал")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {selectedChannel?.description ?? tr("Откройте канал из списка или создайте новый.")}
                      </p>
                    </div>
                  </div>
                  {selectedChannel && (
                    <div className="flex flex-wrap items-center gap-2">
                      {canManage ? <Button size="sm" variant="outline" onClick={() => setShowMembers((prev) => !prev)}>
                        <UsersIcon className="size-4" />
                        {showMembers ? tr("Скрыть участников") : tr("Участники")}
                      </Button> : null}
                      {selectedChannel.myRole !== "OWNER" ? (
                        <Button size="sm" variant="outline" onClick={leaveChannel} disabled={isLeavingChannel}>
                          {isLeavingChannel ? "Выходим..." : "Покинуть канал"}
                        </Button>
                      ) : null}
                      {canDeleteSelectedChannel ? <Button size="sm" variant="destructive" onClick={deleteChannel} disabled={isDeletingChannel}>
                        {isDeletingChannel ? tr("Удаляем...") : tr("Удалить канал")}
                      </Button> : null}
                    </div>
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
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-start gap-3 text-left"
                                onClick={() => openProfile(participant.id)}
                              >
                                <UserAvatar
                                  firstName={participant.firstName}
                                  lastName={participant.lastName}
                                  avatarTone={participant.avatarTone}
                                  avatarUrl={participant.avatarUrl}
                                  className="size-11 shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-medium">
                                      {participant.firstName} {participant.lastName ?? ""}
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
                              </button>
                              {canManage && participant.channelRole !== "OWNER" && (
                                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
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
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={isRemovingParticipant}
                                    onClick={() => removeParticipant(participant.id)}
                                  >
                                    {isRemovingParticipant ? tr("Удаляем...") : tr("Выгнать")}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

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
                              <UserAvatar
                                firstName={contact.firstName}
                                lastName={contact.lastName}
                                avatarTone={contact.avatarTone}
                                avatarUrl={contact.avatarUrl}
                                className="size-9 shrink-0"
                              />
                              <span className="flex min-w-0 flex-wrap items-center gap-2">
                                <span className="truncate">
                                  {contact.firstName} {contact.lastName ?? ""}
                                </span>
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
                    </div>
                  </div>
                )}

                <div className="px-4 pt-4">
                  <ContactProfileCard
                    profile={selectedProfile}
                    isLoading={isProfileLoading}
                    onClose={() => {
                      setSelectedProfile(null)
                      setIsProfileLoading(false)
                    }}
                    onOpenChat={(contactId) => router.push(`/chats?contactId=${contactId}`)}
                    onStartAudioCall={(contactId) => openChatWithCall(contactId, "audio")}
                    onStartVideoCall={(contactId) => openChatWithCall(contactId, "video")}
                  />
                </div>

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
                        className={`mb-3 flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
                      >
                        {!mine && (
                          <button type="button" onClick={() => openProfile(message.author.id)}>
                            <UserAvatar
                              firstName={message.author.firstName}
                              lastName={message.author.lastName}
                              avatarTone={message.author.avatarTone}
                              avatarUrl={message.author.avatarUrl}
                              className="size-9 shrink-0"
                            />
                          </button>
                        )}
                        <div
                          className={`w-fit max-w-[85%] rounded-[1.35rem] px-3.5 py-2.5 text-sm shadow-sm ${
                            mine
                              ? "rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-bl-md border border-white/45 bg-background/96 text-foreground dark:border-white/8"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          <MessageAttachmentView attachment={message.attachment} compact />
                          <p className="mt-1 text-[11px] opacity-75">
                            {!mine && `${message.author.firstName} ${message.author.lastName ?? ""} · `}
                            {new Date(message.createdAt).toLocaleString("ru-RU")}
                          </p>
                        </div>
                        {mine && canWrite ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="inline-flex size-8 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted-foreground hover:bg-accent"
                              aria-label="Действия с сообщением"
                            >
                              <EllipsisVerticalIcon className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              {!message.attachment ? (
                                <DropdownMenuItem onClick={() => beginEditMessage(message)}>
                                  Редактировать
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={isDeletingMessage}
                                onClick={() => deleteMessage(message.id)}
                              >
                                Удалить
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    )
                  })}
                </div>

                <div className="sticky bottom-0 shrink-0 border-t border-border/70 bg-background/88 p-2.5 backdrop-blur-xl sm:p-3">
                  {attachmentFile && (
                    <div className="mb-2 flex items-center justify-between gap-3 rounded-[1rem] border border-border/70 bg-card/80 px-3 py-2">
                      <p className="truncate text-sm text-muted-foreground">{attachmentFile.name}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAttachmentFile(null)
                          if (attachmentInputRef.current) {
                            attachmentInputRef.current.value = ""
                          }
                        }}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 rounded-[1.6rem] border border-white/45 bg-card/92 p-2 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.65)] dark:border-white/8 sm:rounded-[1.85rem] sm:p-2.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 lg:hidden"
                      onClick={() => setShowMembers((prev) => !prev)}
                      disabled={!selectedChannel || !canManage}
                    >
                      <ArrowLeftIcon className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 rounded-full"
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={!canWrite || isSending || !selectedChannel}
                    >
                      <PaperclipIcon className="size-4" />
                    </Button>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                      className="hidden"
                      onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)}
                    />
                    <Input
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                      placeholder={
                        canWrite
                          ? tr("Сообщение в канал")
                          : tr("Писать могут только владелец и админы")
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
                      className="min-w-0 rounded-full px-4 sm:min-w-28"
                      onClick={sendMessage}
                      disabled={!canWrite || isSending || (!messageText.trim() && !attachmentFile) || !selectedChannel}
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
