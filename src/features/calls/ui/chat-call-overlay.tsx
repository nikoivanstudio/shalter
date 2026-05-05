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
  Volume1Icon,
  Volume2Icon,
} from "lucide-react"
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/shared/ui/user-avatar"

type CallMediaMode = "audio" | "video"
type VolumePreset = "quiet" | "normal" | "loud"

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

const VOLUME_LEVELS: Record<VolumePreset, number> = {
  quiet: 0.35,
  normal: 0.8,
  loud: 1,
}

function getDisplayName(user: CallUser) {
  const fullName = `${user.firstName} ${user.lastName ?? ""}`.trim()
  return fullName || user.email
}

function isVideoStream(stream: MediaStream | null) {
  return Boolean(stream?.getVideoTracks().some((track) => track.enabled))
}

function VolumeLabel({
  preset,
  active,
  onClick,
}: {
  preset: VolumePreset
  active: boolean
  onClick: () => void
}) {
  const labels: Record<VolumePreset, string> = {
    quiet: "Тихо",
    normal: "Обычно",
    loud: "Громко",
  }

  return (
    <Button type="button" size="sm" variant={active ? "secondary" : "outline"} onClick={onClick}>
      {preset === "loud" ? <Volume2Icon className="size-4" /> : <Volume1Icon className="size-4" />}
      {labels[preset]}
    </Button>
  )
}

function VideoTile({
  label,
  user,
  stream,
  muted = false,
  volume = 1,
}: {
  label?: string
  user: CallUser
  stream: MediaStream | null
  muted?: boolean
  volume?: number
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasVideo = isVideoStream(stream)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = hasVideo ? stream : null
      videoRef.current.volume = muted ? 0 : volume
    }

    if (audioRef.current) {
      audioRef.current.srcObject = stream
      audioRef.current.volume = muted ? 0 : volume
    }
  }, [hasVideo, muted, stream, volume])

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
  initialAutoStartCall = null,
  startRequest = null,
}: {
  currentUser: CallUser
  dialogs: Array<{
    id: number
    title: string | null
    users: CallUser[]
  }>
  selectedDialogId: number | null
  initialAutoStartCall?: CallMediaMode | null
  startRequest?: { media: CallMediaMode; nonce: number } | null
}) {
  const [activeCall, setActiveCall] = useState<CallSnapshot | null>(null)
  const [incomingCall, setIncomingCall] = useState<CallSnapshot | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false)
  const [isCameraDisabled, setIsCameraDisabled] = useState(false)
  const [remoteStreams, setRemoteStreams] = useState<Record<number, RemoteStreamEntry>>({})
  const [volumePreset, setVolumePreset] = useState<VolumePreset>("normal")
  const [, forceLocalStreamRender] = useState(0)

  const localStreamRef = useRef<MediaStream | null>(null)
  const incomingToneIntervalRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const peerConnectionsRef = useRef(new Map<number, RTCPeerConnection>())
  const pendingIceCandidatesRef = useRef(new Map<number, RTCIceCandidateInit[]>())
  const activeCallRef = useRef<CallSnapshot | null>(null)
  const incomingCallRef = useRef<CallSnapshot | null>(null)
  const autoStartDoneRef = useRef(false)
  const lastHandledStartRequestNonceRef = useRef<number | null>(null)
  const startCallEffect = useEffectEvent((media: CallMediaMode) => {
    void startCall(media)
  })

  const activeDialog = useMemo(
    () => dialogs.find((dialog) => dialog.id === (activeCall?.dialogId ?? selectedDialogId)) ?? null,
    [activeCall?.dialogId, dialogs, selectedDialogId]
  )

  useEffect(() => {
    activeCallRef.current = activeCall
  }, [activeCall])

  useEffect(() => {
    incomingCallRef.current = incomingCall
  }, [incomingCall])

  const stopIncomingTone = useCallback(() => {
    if (incomingToneIntervalRef.current !== null) {
      window.clearInterval(incomingToneIntervalRef.current)
      incomingToneIntervalRef.current = null
    }
  }, [])

  const playIncomingTone = useCallback(() => {
    if (typeof window === "undefined") {
      return
    }

    try {
      const AudioContextCtor = window.AudioContext ?? (window as typeof window & {
        webkitAudioContext?: typeof AudioContext
      }).webkitAudioContext

      if (!AudioContextCtor) {
        return
      }

      const audioContext = audioContextRef.current ?? new AudioContextCtor()
      audioContextRef.current = audioContext

      if (audioContext.state === "suspended") {
        void audioContext.resume().catch(() => null)
      }

      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      oscillator.type = "sine"
      oscillator.frequency.value = 880
      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.28)
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch {
      // Ignore ringtone failures caused by autoplay restrictions.
    }
  }, [])

  useEffect(() => {
    if (!incomingCall || incomingCall.createdByUserId === currentUser.userId) {
      stopIncomingTone()
      return
    }

    playIncomingTone()
    incomingToneIntervalRef.current = window.setInterval(() => {
      playIncomingTone()
    }, 1800)

    return () => {
      stopIncomingTone()
    }
  }, [currentUser.userId, incomingCall, playIncomingTone, stopIncomingTone])

  useEffect(() => {
    return () => {
      stopIncomingTone()
      void audioContextRef.current?.close().catch(() => null)
      audioContextRef.current = null
    }
  }, [stopIncomingTone])

  useEffect(() => {
    autoStartDoneRef.current = false
  }, [initialAutoStartCall, selectedDialogId])

  useEffect(() => {
    if (
      autoStartDoneRef.current ||
      !initialAutoStartCall ||
      !selectedDialogId ||
      activeCall ||
      incomingCall ||
      isConnecting
    ) {
      return
    }

    autoStartDoneRef.current = true
    startCallEffect(initialAutoStartCall)
  }, [activeCall, incomingCall, initialAutoStartCall, isConnecting, selectedDialogId])

  useEffect(() => {
    if (
      !startRequest ||
      lastHandledStartRequestNonceRef.current === startRequest.nonce ||
      !selectedDialogId ||
      activeCall ||
      incomingCall ||
      isConnecting
    ) {
      return
    }

    lastHandledStartRequestNonceRef.current = startRequest.nonce
    startCallEffect(startRequest.media)
  }, [activeCall, incomingCall, isConnecting, selectedDialogId, startRequest])

  const getRemoteUser = useCallback(
    (call: CallSnapshot, userId: number) => {
      return (
        call.participants.find((participant) => participant.userId === userId) ??
        call.invitedUsers.find((participant) => participant.userId === userId) ??
        dialogs.flatMap((dialog) => dialog.users).find((user) => user.userId === userId) ??
        null
      )
    },
    [dialogs]
  )

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

  const destroyPeer = useCallback(
    (remoteUserId: number) => {
      const peer = peerConnectionsRef.current.get(remoteUserId)
      if (!peer) {
        return
      }

      peer.close()
      peerConnectionsRef.current.delete(remoteUserId)
      pendingIceCandidatesRef.current.delete(remoteUserId)
      removeRemoteStream(remoteUserId)
    },
    [removeRemoteStream]
  )

  const updateRemoteTrack = useCallback((user: CallUser, track: MediaStreamTrack) => {
    setRemoteStreams((prev) => {
      const existing = prev[user.userId]
      const stream = existing?.stream ?? new MediaStream()
      const sameKindTracks = stream.getTracks().filter((item) => item.kind === track.kind)
      for (const existingTrack of sameKindTracks) {
        if (existingTrack.id !== track.id) {
          stream.removeTrack(existingTrack)
        }
      }
      if (!stream.getTracks().some((item) => item.id === track.id)) {
        stream.addTrack(track)
      }

      return {
        ...prev,
        [user.userId]: { user, stream },
      }
    })
  }, [])

  const syncLocalStreamToPeers = useCallback((stream: MediaStream | null) => {
    for (const peer of peerConnectionsRef.current.values()) {
      const audioTrack = stream?.getAudioTracks()[0] ?? null
      const videoTrack = stream?.getVideoTracks()[0] ?? null
      const audioSender =
        peer.getSenders().find((sender) => sender.track?.kind === "audio") ?? null
      const videoSender =
        peer.getSenders().find((sender) => sender.track?.kind === "video") ?? null

      if (audioSender) {
        void audioSender.replaceTrack(audioTrack)
      } else if (audioTrack && stream) {
        peer.addTrack(audioTrack, stream)
      }

      if (videoSender) {
        void videoSender.replaceTrack(videoTrack)
      } else if (videoTrack && stream) {
        peer.addTrack(videoTrack, stream)
      }
    }
  }, [])

  async function sendSignal(callId: string, toUserId: number, signal: CallSignalPayload) {
    await fetch(`/api/calls/${callId}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId, signal }),
    })
  }

  const flushPendingIceCandidates = useCallback(async (remoteUserId: number) => {
    const peer = peerConnectionsRef.current.get(remoteUserId)
    const candidates = pendingIceCandidatesRef.current.get(remoteUserId)
    if (!peer || !peer.remoteDescription || !candidates?.length) {
      return
    }

    pendingIceCandidatesRef.current.delete(remoteUserId)
    for (const candidate of candidates) {
      try {
        await peer.addIceCandidate(candidate)
      } catch {
        // Ignore invalid or stale ICE candidates.
      }
    }
  }, [])

  const ensurePeerConnection = useCallback(
    (call: CallSnapshot, remoteUserId: number) => {
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
        updateRemoteTrack(remoteUser, event.track)
      }

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed" || peer.connectionState === "closed") {
          destroyPeer(remoteUserId)
        }
      }

      return peer
    },
    [destroyPeer, getRemoteUser, updateRemoteTrack]
  )

  async function createOfferForRemote(call: CallSnapshot, remoteUserId: number) {
    const peer = ensurePeerConnection(call, remoteUserId)
    const offer = await peer.createOffer()
    await peer.setLocalDescription(offer)
    await sendSignal(call.id, remoteUserId, {
      type: "offer",
      payload: offer,
    })
  }

  const handleSignal = useCallback(
    async (fromUserId: number, signal: CallSignalPayload) => {
      const call = activeCallRef.current
      if (!call) {
        return
      }

      const peer = ensurePeerConnection(call, fromUserId)

      if (signal.type === "offer") {
        await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit)
        await flushPendingIceCandidates(fromUserId)
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
        await flushPendingIceCandidates(fromUserId)
        return
      }

      if (signal.type === "ice-candidate" && signal.payload) {
        const candidate = signal.payload as RTCIceCandidateInit
        if (!peer.remoteDescription) {
          const pending = pendingIceCandidatesRef.current.get(fromUserId) ?? []
          pending.push(candidate)
          pendingIceCandidatesRef.current.set(fromUserId, pending)
          return
        }

        try {
          await peer.addIceCandidate(candidate)
        } catch {
          // Ignore invalid or stale ICE candidates.
        }
      }
    },
    [ensurePeerConnection, flushPendingIceCandidates]
  )

  async function ensureLocalStream(media: CallMediaMode) {
    const existingStream = localStreamRef.current
    const needsVideoUpgrade = media === "video" && !existingStream?.getVideoTracks().length

    if (existingStream && !needsVideoUpgrade) {
      for (const track of existingStream.getAudioTracks()) {
        track.enabled = true
      }
      for (const track of existingStream.getVideoTracks()) {
        track.enabled = media === "video"
      }
      syncLocalStreamToPeers(existingStream)
      setIsMicrophoneMuted(false)
      setIsCameraDisabled(media !== "video")
      forceLocalStreamRender((value) => value + 1)
      return existingStream
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: media === "video",
    })

    if (existingStream) {
      for (const track of existingStream.getTracks()) {
        track.stop()
      }
    }

    localStreamRef.current = stream
    syncLocalStreamToPeers(stream)
    setIsMicrophoneMuted(false)
    setIsCameraDisabled(media !== "video")
    forceLocalStreamRender((value) => value + 1)
    return stream
  }

  const cleanupCall = useCallback(async (announceLeave = true) => {
    const currentCall = activeCallRef.current
    stopIncomingTone()

    if (announceLeave && currentCall) {
      await fetch(`/api/calls/${currentCall.id}/leave`, { method: "POST" }).catch(() => null)
    }

    for (const peer of peerConnectionsRef.current.values()) {
      peer.close()
    }
    peerConnectionsRef.current.clear()
    pendingIceCandidatesRef.current.clear()

    for (const track of localStreamRef.current?.getTracks() ?? []) {
      track.stop()
    }
    localStreamRef.current = null
    forceLocalStreamRender((value) => value + 1)
    setRemoteStreams({})
    setActiveCall(null)
    setIncomingCall(null)
    activeCallRef.current = null
    incomingCallRef.current = null
    setIsConnecting(false)
    setIsMicrophoneMuted(false)
    setIsCameraDisabled(false)
    setVolumePreset("normal")
  }, [stopIncomingTone])

  async function rejectIncomingCall(call: CallSnapshot | null) {
    if (!call) {
      return
    }

    stopIncomingTone()
    await fetch(`/api/calls/${call.id}/reject`, { method: "POST" }).catch(() => null)
    setIncomingCall(null)
  }

  async function joinCall(call: CallSnapshot) {
    setIsConnecting(true)

    try {
      stopIncomingTone()
      await ensureLocalStream(call.media)

      const response = await fetch(`/api/calls/${call.id}/join`, { method: "POST" })
      const data = (await response.json().catch(() => null)) as { call?: CallSnapshot; message?: string } | null

      if (!response.ok || !data?.call) {
        throw new Error(data?.message ?? "Не удалось подключиться к звонку")
      }

      setIncomingCall(null)
      incomingCallRef.current = null
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
    syncLocalStreamToPeers(localStreamRef.current)
  }

  function toggleCamera() {
    const nextDisabled = !isCameraDisabled
    setIsCameraDisabled(nextDisabled)
    for (const track of localStreamRef.current?.getVideoTracks() ?? []) {
      track.enabled = !nextDisabled
    }
    syncLocalStreamToPeers(localStreamRef.current)
  }

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

        if (!current) {
          if (activeCallRef.current || incomingCallRef.current) {
            void cleanupCall(false)
          }
          return
        }

        const joined = current.participants.some(
          (participant) => participant.userId === currentUser.userId
        )
        setActiveCall(joined ? current : null)
        setIncomingCall(joined ? null : current)
        return
      }

      if (payload.type === "call.invited") {
        if (payload.call.createdByUserId !== currentUser.userId) {
          setIncomingCall(payload.call)
          toast.message(`Входящий ${payload.call.media === "video" ? "видеозвонок" : "звонок"}`)
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
          if (activeCallRef.current?.id === payload.call.id) {
            void cleanupCall(false)
          }
          if (incomingCallRef.current?.id === payload.call.id) {
            setIncomingCall(null)
          }
          return
        }

        setActiveCall((prev) => (prev?.id === payload.call.id || isMember ? payload.call : prev))
        setIncomingCall((prev) =>
          isMember ? null : prev?.id === payload.call.id || isInvited ? payload.call : prev
        )
        return
      }

      if (payload.type === "call.ended") {
        if (activeCallRef.current?.id === payload.callId || incomingCallRef.current?.id === payload.callId) {
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
  }, [cleanupCall, currentUser.userId, handleSignal])

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
  }, [activeCall, currentUser.userId, destroyPeer])

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

  const remoteTiles = Object.values(remoteStreams)
  const localUser = currentUser
  const showOverlay = Boolean(activeCall || incomingCall)
  const canToggleCamera = activeCall?.media === "video"
  const remoteVolume = VOLUME_LEVELS[volumePreset]
  const incomingCaller =
    incomingCall?.participants.find((user) => user.userId !== currentUser.userId) ??
    incomingCall?.invitedUsers.find((user) => user.userId !== currentUser.userId) ??
    currentUser

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
                    : `Звонит ${getDisplayName(incomingCaller)}`}
                </p>
              </div>

              {activeCall ? (
                <div className="flex flex-wrap items-center gap-2">
                  <VolumeLabel
                    preset="quiet"
                    active={volumePreset === "quiet"}
                    onClick={() => setVolumePreset("quiet")}
                  />
                  <VolumeLabel
                    preset="normal"
                    active={volumePreset === "normal"}
                    onClick={() => setVolumePreset("normal")}
                  />
                  <VolumeLabel
                    preset="loud"
                    active={volumePreset === "loud"}
                    onClick={() => setVolumePreset("loud")}
                  />
                  <Button
                    type="button"
                    variant={isMicrophoneMuted ? "secondary" : "outline"}
                    onClick={toggleMicrophone}
                  >
                    {isMicrophoneMuted ? <MicOffIcon className="size-4" /> : <MicIcon className="size-4" />}
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
                    onClick={() => void rejectIncomingCall(incomingCall)}
                  >
                    <PhoneOffIcon className="size-4" />
                    Отклонить
                  </Button>
                </div>
              )}
            </div>

            {activeCall ? (
              <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid min-h-0 content-start gap-4 overflow-y-auto pr-1 md:grid-cols-2">
                  {remoteTiles.length > 0 ? (
                    remoteTiles.map((entry) => (
                      <VideoTile
                        key={entry.user.userId}
                        user={entry.user}
                        stream={entry.stream}
                        volume={remoteVolume}
                      />
                    ))
                  ) : (
                    <div className="flex min-h-48 items-center justify-center rounded-[1.6rem] border border-dashed border-white/15 bg-white/3 p-8 text-center text-white/70">
                      Ждём, пока кто-нибудь подключится к звонку.
                    </div>
                  )}
                </div>

                <div className="flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/4 p-4">
                  <VideoTile label="Вы" user={localUser} stream={localStreamRef.current} muted />

                  <div className="mt-4 flex min-h-0 flex-1 flex-col space-y-2">
                    <p className="text-sm font-medium text-white/80">Участники</p>
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
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
                              {participant.userId === currentUser.userId ? "Подключены" : "В звонке"}
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
                            <p className="text-xs text-white/60">Звоним...</p>
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
                  <p className="mt-4 text-xl font-semibold">{getDisplayName(incomingCaller)}</p>
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
