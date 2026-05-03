"use client"

import {
  MicIcon,
  MicOffIcon,
  MonitorUpIcon,
  PhoneCallIcon,
  PhoneIcon,
  PhoneOffIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

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

type CallSignalPayload = {
  type: "offer" | "answer" | "ice-candidate"
  payload: unknown
}

type CallEvent =
  | { type: "call.snapshot"; calls: CallSnapshot[] }
  | { type: "call.invited"; call: CallSnapshot }
  | { type: "call.updated"; call: CallSnapshot }
  | { type: "call.ended"; callId: string }
  | { type: "call.signal"; callId: string; fromUserId: number; signal: CallSignalPayload }

type RemoteStreamEntry = {
  user: CallUser
  stream: MediaStream
}

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
}

function getDisplayName(user: CallUser) {
  const fullName = `${user.firstName} ${user.lastName ?? ""}`.trim()
  return fullName || user.email
}

function isVideoStream(stream: MediaStream | null) {
  return Boolean(stream?.getVideoTracks().some((track) => track.enabled))
}

function VideoTile({
  label,
  user,
  stream,
  muted = false,
}: {
  label?: string
  user: CallUser
  stream: MediaStream | null
  muted?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasVideo = isVideoStream(stream)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = hasVideo ? stream : null
    }

    if (audioRef.current) {
      audioRef.current.srcObject = stream
    }
  }, [hasVideo, stream])

  return (
    <div className="relative overflow-hidden rounded-[1.6rem] border border-white/15 bg-black/30">
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="h-full min-h-48 w-full object-cover"
        />
      ) : (
        <div className="flex min-h-48 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.24),_transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <UserAvatar
              firstName={user.firstName}
              lastName={user.lastName}
              avatarTone={user.avatarTone}
              avatarUrl={user.avatarUrl}
              className="size-20 border border-white/20"
              textClassName="text-2xl font-semibold"
            />
            <div>
              <p className="text-base font-semibold text-white">{getDisplayName(user)}</p>
              <p className="text-sm text-white/70">Аудиозвонок</p>
            </div>
          </div>
        </div>
      )}

      <audio ref={audioRef} autoPlay playsInline muted={muted} />

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-linear-to-t from-black/70 to-transparent px-4 py-3 text-white">
        <p className="truncate text-sm font-medium">{label ?? getDisplayName(user)}</p>
        {!hasVideo ? <PhoneIcon className="size-4 text-white/80" /> : null}
      </div>
    </div>
  )
}

export function ChatCallOverlay({
  currentUser,
  dialogs,
  selectedDialogId,
}: {
  currentUser: CallUser
  dialogs: Array<{
    id: number
    title: string | null
    users: CallUser[]
  }>
  selectedDialogId: number | null
}) {
  const [activeCall, setActiveCall] = useState<CallSnapshot | null>(null)
  const [incomingCall, setIncomingCall] = useState<CallSnapshot | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false)
  const [isCameraDisabled, setIsCameraDisabled] = useState(false)
  const [remoteStreams, setRemoteStreams] = useState<Record<number, RemoteStreamEntry>>({})
  const [, forceLocalStreamRender] = useState(0)

  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef(new Map<number, RTCPeerConnection>())
  const activeCallRef = useRef<CallSnapshot | null>(null)

  const activeDialog = useMemo(
    () => dialogs.find((dialog) => dialog.id === (activeCall?.dialogId ?? selectedDialogId)) ?? null,
    [activeCall?.dialogId, dialogs, selectedDialogId]
  )

  useEffect(() => {
    activeCallRef.current = activeCall
  }, [activeCall])

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const eventSource = new EventSource("/api/calls/events")

    const onEvent = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as CallEvent

      if (payload.type === "call.snapshot") {
        const current = payload.calls.find(
          (call) =>
            call.participants.some((participant) => participant.userId === currentUser.userId) ||
            call.invitedUsers.some((user) => user.userId === currentUser.userId)
        )

        if (current) {
          const joined = current.participants.some(
            (participant) => participant.userId === currentUser.userId
          )
          setActiveCall(joined ? current : null)
          setIncomingCall(joined ? null : current)
        }

        return
      }

      if (payload.type === "call.invited") {
        if (payload.call.createdByUserId !== currentUser.userId) {
          setIncomingCall(payload.call)
          toast.message(
            `Входящий ${payload.call.media === "video" ? "видеозвонок" : "звонок"}`
          )
        }
        return
      }

      if (payload.type === "call.updated") {
        const isMember = payload.call.participants.some(
          (participant) => participant.userId === currentUser.userId
        )
        const isInvited = payload.call.invitedUsers.some(
          (participant) => participant.userId === currentUser.userId
        )

        if (!isMember && !isInvited) {
          return
        }

        setActiveCall((prev) => (prev?.id === payload.call.id || isMember ? payload.call : prev))
        setIncomingCall((prev) =>
          isMember ? null : prev?.id === payload.call.id || isInvited ? payload.call : prev
        )
        return
      }

      if (payload.type === "call.ended") {
        if (activeCallRef.current?.id === payload.callId || incomingCall?.id === payload.callId) {
          toast.message("Звонок завершён")
          void cleanupCall(false)
        }
        return
      }

      if (payload.type === "call.signal") {
        if (activeCallRef.current?.id !== payload.callId) {
          return
        }
        void handleSignal(payload.fromUserId, payload.signal)
      }
    }

    eventSource.addEventListener("call.snapshot", onEvent as EventListener)
    eventSource.addEventListener("call.invited", onEvent as EventListener)
    eventSource.addEventListener("call.updated", onEvent as EventListener)
    eventSource.addEventListener("call.ended", onEvent as EventListener)
    eventSource.addEventListener("call.signal", onEvent as EventListener)

    return () => {
      eventSource.close()
    }
  }, [currentUser.userId, incomingCall?.id])
  /* eslint-enable react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!activeCall) {
      return
    }

    const activeRemoteUserIds = new Set(
      activeCall.participants
        .map((participant) => participant.userId)
        .filter((userId) => userId !== currentUser.userId)
    )

    for (const remoteUserId of peerConnectionsRef.current.keys()) {
      if (!activeRemoteUserIds.has(remoteUserId)) {
        destroyPeer(remoteUserId)
      }
    }
  }, [activeCall, currentUser.userId])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const handlePageHide = () => {
      const currentCall = activeCallRef.current
      if (!currentCall) {
        return
      }

      void fetch(`/api/calls/${currentCall.id}/leave`, {
        method: "POST",
        keepalive: true,
      }).catch(() => null)
    }

    window.addEventListener("pagehide", handlePageHide)
    return () => {
      window.removeEventListener("pagehide", handlePageHide)
    }
  }, [])

  async function sendSignal(callId: string, toUserId: number, signal: CallSignalPayload) {
    await fetch(`/api/calls/${callId}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId, signal }),
    })
  }

  const getRemoteUser = useCallback((call: CallSnapshot, userId: number) => {
    return (
      call.participants.find((participant) => participant.userId === userId) ??
      call.invitedUsers.find((participant) => participant.userId === userId) ??
      dialogs.flatMap((dialog) => dialog.users).find((user) => user.userId === userId) ??
      null
    )
  }, [dialogs])

  function updateRemoteStream(user: CallUser, stream: MediaStream) {
    setRemoteStreams((prev) => ({
      ...prev,
      [user.userId]: { user, stream },
    }))
  }

  const removeRemoteStream = useCallback((userId: number) => {
    setRemoteStreams((prev) => {
      if (!prev[userId]) {
        return prev
      }

      const next = { ...prev }
      delete next[userId]
      return next
    })
  }, [])

  const destroyPeer = useCallback((remoteUserId: number) => {
    const peer = peerConnectionsRef.current.get(remoteUserId)
    if (!peer) {
      return
    }

    peer.close()
    peerConnectionsRef.current.delete(remoteUserId)
    removeRemoteStream(remoteUserId)
  }, [removeRemoteStream])

  const ensurePeerConnection = useCallback((call: CallSnapshot, remoteUserId: number) => {
    const existing = peerConnectionsRef.current.get(remoteUserId)
    if (existing) {
      return existing
    }

    const remoteUser = getRemoteUser(call, remoteUserId)
    if (!remoteUser) {
      throw new Error("Не удалось определить собеседника для звонка")
    }

    const peer = new RTCPeerConnection(RTC_CONFIGURATION)
    peerConnectionsRef.current.set(remoteUserId, peer)

    for (const track of localStreamRef.current?.getTracks() ?? []) {
      peer.addTrack(track, localStreamRef.current as MediaStream)
    }

    peer.onicecandidate = (event) => {
      if (!event.candidate || !activeCallRef.current) {
        return
      }

      void sendSignal(activeCallRef.current.id, remoteUserId, {
        type: "ice-candidate",
        payload: event.candidate.toJSON(),
      })
    }

    peer.ontrack = (event) => {
      const [stream] = event.streams
      if (stream) {
        updateRemoteStream(remoteUser, stream)
      }
    }

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "failed" || peer.connectionState === "closed") {
        destroyPeer(remoteUserId)
      }
    }

    return peer
  }, [destroyPeer, getRemoteUser])

  async function createOfferForRemote(call: CallSnapshot, remoteUserId: number) {
    const peer = ensurePeerConnection(call, remoteUserId)
    const offer = await peer.createOffer()
    await peer.setLocalDescription(offer)
    await sendSignal(call.id, remoteUserId, {
      type: "offer",
      payload: offer,
    })
  }

  const handleSignal = useCallback(async (fromUserId: number, signal: CallSignalPayload) => {
    const call = activeCallRef.current
    if (!call) {
      return
    }

    const peer = ensurePeerConnection(call, fromUserId)

    if (signal.type === "offer") {
      await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit)
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      await sendSignal(call.id, fromUserId, {
        type: "answer",
        payload: answer,
      })
      return
    }

    if (signal.type === "answer") {
      await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit)
      return
    }

    if (signal.type === "ice-candidate" && signal.payload) {
      await peer.addIceCandidate(signal.payload as RTCIceCandidateInit)
    }
  }, [ensurePeerConnection])

  async function ensureLocalStream(media: CallMediaMode) {
    if (localStreamRef.current) {
      return localStreamRef.current
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: media === "video",
    })

    localStreamRef.current = stream
    setIsMicrophoneMuted(false)
    setIsCameraDisabled(media !== "video")
    forceLocalStreamRender((value) => value + 1)
    return stream
  }

  async function cleanupCall(announceLeave = true) {
    const currentCall = activeCallRef.current

    if (announceLeave && currentCall) {
      await fetch(`/api/calls/${currentCall.id}/leave`, { method: "POST" }).catch(() => null)
    }

    for (const peer of peerConnectionsRef.current.values()) {
      peer.close()
    }
    peerConnectionsRef.current.clear()

    for (const track of localStreamRef.current?.getTracks() ?? []) {
      track.stop()
    }
    localStreamRef.current = null
    forceLocalStreamRender((value) => value + 1)
    setRemoteStreams({})
    setActiveCall(null)
    setIncomingCall(null)
    activeCallRef.current = null
    setIsConnecting(false)
    setIsMicrophoneMuted(false)
    setIsCameraDisabled(false)
  }

  async function joinCall(call: CallSnapshot) {
    setIsConnecting(true)

    try {
      await ensureLocalStream(call.media)

      const response = await fetch(`/api/calls/${call.id}/join`, { method: "POST" })
      const data = (await response.json().catch(() => null)) as { call?: CallSnapshot; message?: string } | null

      if (!response.ok || !data?.call) {
        throw new Error(data?.message ?? "Не удалось подключиться к звонку")
      }

      setIncomingCall(null)
      setActiveCall(data.call)
      activeCallRef.current = data.call

      const existingParticipants = data.call.participants.filter(
        (participant) => participant.userId !== currentUser.userId
      )

      for (const participant of existingParticipants) {
        await createOfferForRemote(data.call, participant.userId)
      }
    } catch (error) {
      await cleanupCall(false)
      toast.error(error instanceof Error ? error.message : "Не удалось начать звонок")
    } finally {
      setIsConnecting(false)
    }
  }

  async function startCall(media: CallMediaMode) {
    if (!selectedDialogId) {
      toast.error("Сначала откройте чат")
      return
    }

    setIsConnecting(true)

    try {
      const response = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dialogId: selectedDialogId, media }),
      })
      const data = (await response.json().catch(() => null)) as { call?: CallSnapshot; message?: string } | null

      if (!response.ok || !data?.call) {
        throw new Error(data?.message ?? "Не удалось создать звонок")
      }

      await joinCall(data.call)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось начать звонок")
      setIsConnecting(false)
    }
  }

  async function endCurrentCall() {
    const currentCall = activeCallRef.current
    if (!currentCall) {
      return
    }

    await fetch(`/api/calls/${currentCall.id}/end`, { method: "POST" }).catch(() => null)
    await cleanupCall(false)
  }

  function toggleMicrophone() {
    const nextMuted = !isMicrophoneMuted
    setIsMicrophoneMuted(nextMuted)
    for (const track of localStreamRef.current?.getAudioTracks() ?? []) {
      track.enabled = !nextMuted
    }
  }

  function toggleCamera() {
    const nextDisabled = !isCameraDisabled
    setIsCameraDisabled(nextDisabled)
    for (const track of localStreamRef.current?.getVideoTracks() ?? []) {
      track.enabled = !nextDisabled
    }
  }

  const remoteTiles = Object.values(remoteStreams)
  const localUser = currentUser
  const showOverlay = Boolean(activeCall || incomingCall)
  const canToggleCamera = activeCall?.media === "video"

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!selectedDialogId || isConnecting || Boolean(activeCall)}
          onClick={() => startCall("audio")}
        >
          <PhoneCallIcon className="size-4" />
          Аудио
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selectedDialogId || isConnecting || Boolean(activeCall)}
          onClick={() => startCall("video")}
        >
          <VideoIcon className="size-4" />
          Видео
        </Button>
      </div>

      {showOverlay ? (
        <div className="fixed inset-0 z-40 bg-slate-950/82 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 rounded-[2rem] border border-white/10 bg-slate-950/92 p-4 text-white shadow-2xl sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-sky-200/70">
                  {activeCall?.media === "video" || incomingCall?.media === "video"
                    ? "Видеозвонок"
                    : "Голосовой звонок"}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {activeDialog?.title ?? "Звонок в чате"}
                </h2>
                <p className="mt-2 text-sm text-white/70">
                  {activeCall
                    ? activeCall.participants.length > 1
                      ? `Участников в звонке: ${activeCall.participants.length}`
                      : "Ожидаем подключения других участников"
                    : incomingCall
                      ? `Звонит ${getDisplayName(
                          incomingCall.participants[0] ??
                            incomingCall.invitedUsers.find(
                              (user) => user.userId !== currentUser.userId
                            ) ??
                            currentUser
                        )}`
                      : ""}
                </p>
              </div>

              {activeCall ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={isMicrophoneMuted ? "secondary" : "outline"}
                    onClick={toggleMicrophone}
                  >
                    {isMicrophoneMuted ? (
                      <MicOffIcon className="size-4" />
                    ) : (
                      <MicIcon className="size-4" />
                    )}
                    {isMicrophoneMuted ? "Микрофон выкл." : "Микрофон"}
                  </Button>
                  {canToggleCamera ? (
                    <Button
                      type="button"
                      variant={isCameraDisabled ? "secondary" : "outline"}
                      onClick={toggleCamera}
                    >
                      {isCameraDisabled ? (
                        <VideoOffIcon className="size-4" />
                      ) : (
                        <MonitorUpIcon className="size-4" />
                      )}
                      {isCameraDisabled ? "Камера выкл." : "Камера"}
                    </Button>
                  ) : null}
                  <Button type="button" variant="destructive" onClick={endCurrentCall}>
                    <PhoneOffIcon className="size-4" />
                    Завершить
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    disabled={isConnecting || !incomingCall}
                    onClick={() => incomingCall && joinCall(incomingCall)}
                  >
                    <PhoneIcon className="size-4" />
                    Ответить
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setIncomingCall(null)}
                  >
                    <PhoneOffIcon className="size-4" />
                    Отклонить
                  </Button>
                </div>
              )}
            </div>

            {activeCall ? (
              <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid min-h-0 gap-4 md:grid-cols-2">
                  {remoteTiles.length > 0 ? (
                    remoteTiles.map((entry) => (
                      <VideoTile
                        key={entry.user.userId}
                        user={entry.user}
                        stream={entry.stream}
                      />
                    ))
                  ) : (
                    <div className="flex min-h-48 items-center justify-center rounded-[1.6rem] border border-dashed border-white/15 bg-white/3 p-8 text-center text-white/70">
                      Ждём, пока кто-нибудь подключится к звонку.
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-[1.6rem] border border-white/10 bg-white/4 p-4">
                  <VideoTile
                    label="Вы"
                    user={localUser}
                    stream={localStreamRef.current}
                    muted
                  />

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-white/80">Участники</p>
                    <div className="space-y-2">
                      {activeCall.participants.map((participant) => (
                        <div
                          key={participant.userId}
                          className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-3 py-2"
                        >
                          <UserAvatar
                            firstName={participant.firstName}
                            lastName={participant.lastName}
                            avatarTone={participant.avatarTone}
                            avatarUrl={participant.avatarUrl}
                            className="size-10 border border-white/10"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {participant.userId === currentUser.userId
                                ? "Вы"
                                : getDisplayName(participant)}
                            </p>
                            <p className="text-xs text-white/60">
                              {participant.userId === currentUser.userId
                                ? "Подключены"
                                : "В звонке"}
                            </p>
                          </div>
                        </div>
                      ))}
                      {activeCall.invitedUsers.map((participant) => (
                        <div
                          key={participant.userId}
                          className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/3 px-3 py-2 opacity-80"
                        >
                          <UserAvatar
                            firstName={participant.firstName}
                            lastName={participant.lastName}
                            avatarTone={participant.avatarTone}
                            avatarUrl={participant.avatarUrl}
                            className="size-10 border border-white/10"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{getDisplayName(participant)}</p>
                            <p className="text-xs text-white/60">Звоним…</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="w-full max-w-md rounded-[1.8rem] border border-white/10 bg-white/4 p-6 text-center">
                  <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-sky-400/12 text-sky-200">
                    {incomingCall?.media === "video" ? (
                      <VideoIcon className="size-9" />
                    ) : (
                      <PhoneIcon className="size-9" />
                    )}
                  </div>
                  <p className="mt-4 text-xl font-semibold">
                    {incomingCall
                      ? getDisplayName(
                          incomingCall.participants[0] ??
                            incomingCall.invitedUsers.find(
                              (user) => user.userId !== currentUser.userId
                            ) ??
                            currentUser
                        )
                      : "Входящий звонок"}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    {incomingCall?.media === "video"
                      ? "Хочет начать видеозвонок"
                      : "Хочет начать голосовой звонок"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
