"use client"

import { PhoneIcon, PhoneOffIcon, VideoIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/shared/ui/user-avatar"

type CallMediaMode = "audio" | "video"

type CallUser = {
  userId: number
  firstName: string
  lastName: string | null
  email: string
  avatarTone?: string | null
  avatarUrl?: string | null
}

type CallParticipant = CallUser & {
  joinedAt: string
}

type CallSnapshot = {
  id: string
  dialogId: number
  media: CallMediaMode
  createdByUserId: number
  createdAt: string
  participants: CallParticipant[]
  invitedUsers: CallUser[]
}

type CallEvent =
  | { type: "call.snapshot"; calls: CallSnapshot[] }
  | { type: "call.invited"; call: CallSnapshot }
  | { type: "call.updated"; call: CallSnapshot }
  | { type: "call.ended"; callId: string }

function getDisplayName(user: CallUser | null) {
  if (!user) {
    return "Неизвестный пользователь"
  }

  return `${user.firstName} ${user.lastName ?? ""}`.trim() || user.email
}

function resolveCaller(call: CallSnapshot) {
  return (
    call.participants.find((user) => user.userId === call.createdByUserId) ??
    call.invitedUsers.find((user) => user.userId === call.createdByUserId) ??
    null
  )
}

export function GlobalIncomingCallWindow() {
  const pathname = usePathname()
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [incomingCall, setIncomingCall] = useState<CallSnapshot | null>(null)
  const [isRejecting, setIsRejecting] = useState(false)

  useEffect(() => {
    let cancelled = false

    void fetch("/api/session")
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.user?.id) {
          return null
        }

        return Number(data.user.id)
      })
      .then((userId) => {
        if (!cancelled && typeof userId === "number" && Number.isInteger(userId) && userId > 0) {
          setCurrentUserId(userId)
        }
      })
      .catch(() => null)

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!currentUserId) {
      return
    }

    const eventSource = new EventSource("/api/calls/events")

    const applyCallState = (calls: CallSnapshot[]) => {
      const nextIncoming =
        calls.find((call) => {
          const joined = call.participants.some((participant) => participant.userId === currentUserId)
          const invited = call.invitedUsers.some((user) => user.userId === currentUserId)
          return invited && !joined
        }) ?? null

      setIncomingCall(nextIncoming)
    }

    const onEvent = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as CallEvent

      if (payload.type === "call.snapshot") {
        applyCallState(payload.calls)
        return
      }

      if (payload.type === "call.invited" || payload.type === "call.updated") {
        applyCallState([payload.call])
        return
      }

      if (payload.type === "call.ended") {
        setIncomingCall((prev) => (prev?.id === payload.callId ? null : prev))
      }
    }

    eventSource.addEventListener("call.snapshot", onEvent as EventListener)
    eventSource.addEventListener("call.invited", onEvent as EventListener)
    eventSource.addEventListener("call.updated", onEvent as EventListener)
    eventSource.addEventListener("call.ended", onEvent as EventListener)

    return () => {
      eventSource.close()
    }
  }, [currentUserId])

  const caller = useMemo(
    () => (incomingCall ? resolveCaller(incomingCall) : null),
    [incomingCall]
  )

  async function rejectCall() {
    if (!incomingCall) {
      return
    }

    setIsRejecting(true)
    try {
      await fetch(`/api/calls/${incomingCall.id}/reject`, { method: "POST" }).catch(() => null)
      setIncomingCall(null)
    } finally {
      setIsRejecting(false)
    }
  }

  function answerCall() {
    if (!incomingCall) {
      return
    }

    location.assign(
      `/chats?dialogId=${incomingCall.dialogId}&answerCall=1&callId=${encodeURIComponent(incomingCall.id)}`
    )
  }

  if (!incomingCall || pathname === "/chats") {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,24rem)] rounded-[1.75rem] border border-white/60 bg-background/95 p-4 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.65)] backdrop-blur-2xl dark:border-white/10">
      <div className="flex items-start gap-3">
        <UserAvatar
          firstName={caller?.firstName ?? "Звонок"}
          lastName={caller?.lastName ?? null}
          avatarTone={caller?.avatarTone}
          avatarUrl={caller?.avatarUrl}
          className="size-14 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Входящий {incomingCall.media === "video" ? "видеозвонок" : "звонок"}
          </p>
          <p className="mt-1 truncate text-base font-semibold">{getDisplayName(caller)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Открыто отдельное окно звонка с быстрыми кнопками.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button type="button" className="flex-1" onClick={answerCall}>
          {incomingCall.media === "video" ? <VideoIcon className="size-4" /> : <PhoneIcon className="size-4" />}
          Ответить
        </Button>
        <Button type="button" variant="destructive" className="flex-1" disabled={isRejecting} onClick={() => void rejectCall()}>
          <PhoneOffIcon className="size-4" />
          Сбросить
        </Button>
      </div>
    </div>
  )
}
