"use client"

import {
  MicIcon,
  MicOffIcon,
  MonitorUpIcon,
  PhoneCallIcon,
  PhoneIcon,
  PhoneOffIcon,
  RefreshCcwIcon,
  UserPlusIcon,
  VideoIcon,
  VideoOffIcon,
  Volume1Icon,
  Volume2Icon,
} from "lucide-react"
import { type ReactNode, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { switchCameraInMediaStream } from "@/shared/lib/media/camera"
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

type CallInviteCandidate = CallUser & {
  phone?: string | null
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

type IceServerConfig = NonNullable<RTCConfiguration["iceServers"]>[number]

type PeerState = {
  pc: RTCPeerConnection
  remoteUser: CallUser
  polite: boolean
  makingOffer: boolean
  negotiationQueued: boolean
  ignoreOffer: boolean
  isSettingRemoteAnswerPending: boolean
  pendingCandidates: RTCIceCandidateInit[]
}

const DEFAULT_ICE_SERVERS: IceServerConfig[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

const VOLUME_LEVELS: Record<VolumePreset, number> = {
  quiet: 0.35,
  normal: 0.8,
  loud: 1,
}

function getDisplayName(user: CallUser) {
  const fullName = `${user.firstName} ${user.lastName ?? ""}`.trim()
  return fullName || user.email
}

function matchesRequestedCall(call: CallSnapshot, requestedCallId: string | null) {
  return !requestedCallId || call.id === requestedCallId
}

function isVideoStream(stream: MediaStream | null) {
  return Boolean(stream?.getVideoTracks().some((track) => track.enabled))
}

async function playMediaElement(element: HTMLMediaElement | null) {
  if (!element) {
    return
  }

  try {
    await element.play()
  } catch {
    // Ignore autoplay restrictions until the user interacts with the page.
  }
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

function CallControlButton({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
  tone = "default",
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  tone?: "default" | "danger" | "success"
}) {
  const toneClass =
    tone === "danger"
      ? "bg-rose-500 text-white shadow-[0_18px_36px_-18px_rgba(244,63,94,0.85)] hover:bg-rose-400"
      : tone === "success"
        ? "bg-emerald-500 text-white shadow-[0_18px_36px_-18px_rgba(16,185,129,0.85)] hover:bg-emerald-400"
        : active
          ? "bg-white text-slate-950 shadow-[0_18px_36px_-18px_rgba(255,255,255,0.75)] hover:bg-white/90"
          : "bg-white/8 text-white hover:bg-white/14"

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-w-[5.25rem] flex-col items-center gap-2 rounded-[1.4rem] px-3 py-3 text-center transition disabled:cursor-not-allowed disabled:opacity-55 ${toneClass}`.trim()}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-black/10">{icon}</span>
      <span className="text-[11px] font-medium leading-none">{label}</span>
    </button>
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
      void playMediaElement(videoRef.current)
    }

    if (audioRef.current) {
      audioRef.current.srcObject = stream
      audioRef.current.volume = muted ? 0 : volume
      void playMediaElement(audioRef.current)
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
  contacts,
  dialogs,
  selectedDialogId,
  autoAnswerIncoming = false,
  autoAnswerCallId = null,
  startRequest = null,
}: {
  currentUser: CallUser
  contacts: CallInviteCandidate[]
  dialogs: Array<{
    id: number
    title: string | null
    users: CallUser[]
  }>
  selectedDialogId: number | null
  autoAnswerIncoming?: boolean
  autoAnswerCallId?: string | null
  startRequest?: { media: CallMediaMode; nonce: number } | null
}) {
  const [activeCall, setActiveCall] = useState<CallSnapshot | null>(null)
  const [incomingCall, setIncomingCall] = useState<CallSnapshot | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false)
  const [isCameraDisabled, setIsCameraDisabled] = useState(false)
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user")
  const [remoteStreams, setRemoteStreams] = useState<Record<number, RemoteStreamEntry>>({})
  const [volumePreset, setVolumePreset] = useState<VolumePreset>("normal")
  const [iceServers, setIceServers] = useState<IceServerConfig[]>(DEFAULT_ICE_SERVERS)
  const [isInvitePanelOpen, setIsInvitePanelOpen] = useState(false)
  const [selectedInviteUserIds, setSelectedInviteUserIds] = useState<number[]>([])
  const [isInvitingParticipants, setIsInvitingParticipants] = useState(false)
  const [, forceLocalStreamRender] = useState(0)

  const localStreamRef = useRef<MediaStream | null>(null)
  const incomingToneIntervalRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const iceServersRef = useRef<IceServerConfig[]>(DEFAULT_ICE_SERVERS)
  const iceServersRequestRef = useRef<Promise<IceServerConfig[]> | null>(null)
  const activeCallRef = useRef<CallSnapshot | null>(null)
  const incomingCallRef = useRef<CallSnapshot | null>(null)
  const peerStatesRef = useRef(new Map<number, PeerState>())
  const autoAnswerHandledRef = useRef(false)
  const lastHandledStartRequestNonceRef = useRef<number | null>(null)
  const startCallEffect = useEffectEvent((media: CallMediaMode) => {
    void startCall(media)
  })
  const autoAnswerEffect = useEffectEvent((call: CallSnapshot) => {
    void joinCall(call)
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

  useEffect(() => {
    iceServersRef.current = iceServers
  }, [iceServers])

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

  const ensureIceServersLoaded = useCallback(async () => {
    if (iceServersRequestRef.current) {
      return iceServersRequestRef.current
    }

    iceServersRequestRef.current = fetch("/api/calls/ice")
      .then(async (response) => {
        if (!response.ok) {
          return DEFAULT_ICE_SERVERS
        }

        const data = (await response.json().catch(() => null)) as
          | { iceServers?: IceServerConfig[] }
          | null

        const nextIceServers =
          Array.isArray(data?.iceServers) && data.iceServers.length > 0
            ? data.iceServers
            : DEFAULT_ICE_SERVERS

        setIceServers(nextIceServers)
        return nextIceServers
      })
      .catch(() => DEFAULT_ICE_SERVERS)

    return iceServersRequestRef.current
  }, [])

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

  const addLocalTracksToPeer = useCallback((pc: RTCPeerConnection, stream: MediaStream | null) => {
    if (!stream) {
      return
    }

    for (const track of stream.getTracks()) {
      const sender = pc.getSenders().find((item) => item.track?.kind === track.kind) ?? null
      if (!sender) {
        pc.addTrack(track, stream)
      }
    }
  }, [])

  const syncLocalStreamToPeers = useCallback(
    (stream: MediaStream | null) => {
      for (const { pc } of peerStatesRef.current.values()) {
        addLocalTracksToPeer(pc, stream)

        const audioTrack = stream?.getAudioTracks()[0] ?? null
        const videoTrack = stream?.getVideoTracks()[0] ?? null
        const audioSender = pc.getSenders().find((sender) => sender.track?.kind === "audio") ?? null
        const videoSender = pc.getSenders().find((sender) => sender.track?.kind === "video") ?? null

        if (audioSender) {
          void audioSender.replaceTrack(audioTrack)
        }

        if (videoSender) {
          void videoSender.replaceTrack(videoTrack)
        }
      }
    },
    [addLocalTracksToPeer]
  )

  const destroyPeer = useCallback(
    (remoteUserId: number) => {
      const state = peerStatesRef.current.get(remoteUserId)
      if (!state) {
        return
      }

      state.pc.ontrack = null
      state.pc.onicecandidate = null
      state.pc.onnegotiationneeded = null
      state.pc.onconnectionstatechange = null
      state.pc.close()
      peerStatesRef.current.delete(remoteUserId)
      removeRemoteStream(remoteUserId)
    },
    [removeRemoteStream]
  )

  const updateRemoteStream = useCallback((user: CallUser, stream: MediaStream) => {
    setRemoteStreams((prev) => ({
      ...prev,
      [user.userId]: { user, stream },
    }))
  }, [])

  async function sendSignal(callId: string, toUserId: number, signal: CallSignalPayload) {
    await fetch(`/api/calls/${callId}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId, signal }),
    })
  }

  const requestPeerNegotiation = useCallback(async (remoteUserId: number, state: PeerState) => {
    if (state.negotiationQueued) {
      return
    }

    state.negotiationQueued = true
    queueMicrotask(() => {
      void (async () => {
        state.negotiationQueued = false

        const currentCall = activeCallRef.current
        if (!currentCall || state.makingOffer || state.pc.signalingState !== "stable") {
          return
        }

        try {
          state.makingOffer = true
          await state.pc.setLocalDescription()

          if (!state.pc.localDescription || !activeCallRef.current) {
            return
          }

          await sendSignal(activeCallRef.current.id, remoteUserId, {
            type: state.pc.localDescription.type === "answer" ? "answer" : "offer",
            payload: state.pc.localDescription.toJSON(),
          })
        } catch {
          // Let the next negotiation cycle recover automatically.
        } finally {
          state.makingOffer = false
        }
      })()
    })
  }, [])

  const ensurePeerState = useCallback(
    (call: CallSnapshot, remoteUserId: number) => {
      const existing = peerStatesRef.current.get(remoteUserId)
      if (existing) {
        return existing
      }

      const remoteUser = getRemoteUser(call, remoteUserId)
      if (!remoteUser) {
        throw new Error("Не удалось определить собеседника для звонка")
      }

      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
      })

      const state: PeerState = {
        pc,
        remoteUser,
        polite: currentUser.userId > remoteUserId,
        makingOffer: false,
        negotiationQueued: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false,
        pendingCandidates: [],
      }

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0] ?? new MediaStream([event.track])
        updateRemoteStream(remoteUser, remoteStream)
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate || !activeCallRef.current) {
          return
        }

        void sendSignal(activeCallRef.current.id, remoteUserId, {
          type: "ice-candidate",
          payload: event.candidate.toJSON(),
        })
      }

      pc.onnegotiationneeded = () => {
        void requestPeerNegotiation(remoteUserId, state)
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          destroyPeer(remoteUserId)
        }
      }

      addLocalTracksToPeer(pc, localStreamRef.current)
      peerStatesRef.current.set(remoteUserId, state)
      if (localStreamRef.current) {
        void requestPeerNegotiation(remoteUserId, state)
      }
      return state
    },
    [
      addLocalTracksToPeer,
      currentUser.userId,
      destroyPeer,
      getRemoteUser,
      requestPeerNegotiation,
      updateRemoteStream,
    ]
  )

  const flushPendingCandidates = useCallback(async (state: PeerState) => {
    if (!state.pc.remoteDescription || state.pendingCandidates.length === 0) {
      return
    }

    const pending = [...state.pendingCandidates]
    state.pendingCandidates = []

    for (const candidate of pending) {
      try {
        await state.pc.addIceCandidate(candidate)
      } catch {
        // Ignore stale ICE candidates.
      }
    }
  }, [])

  const syncPeersWithCall = useCallback(
    (call: CallSnapshot) => {
      const activeRemoteUserIds = new Set(
        call.participants
          .map((participant) => participant.userId)
          .filter((userId) => userId !== currentUser.userId)
      )

      for (const remoteUserId of peerStatesRef.current.keys()) {
        if (!activeRemoteUserIds.has(remoteUserId)) {
          destroyPeer(remoteUserId)
        }
      }

      for (const remoteUserId of activeRemoteUserIds) {
        const state = ensurePeerState(call, remoteUserId)
        state.remoteUser = getRemoteUser(call, remoteUserId) ?? state.remoteUser
        addLocalTracksToPeer(state.pc, localStreamRef.current)
        if (localStreamRef.current) {
          void requestPeerNegotiation(remoteUserId, state)
        }
      }
    },
    [
      addLocalTracksToPeer,
      currentUser.userId,
      destroyPeer,
      ensurePeerState,
      getRemoteUser,
      requestPeerNegotiation,
    ]
  )

  const handleSignal = useCallback(
    async (fromUserId: number, signal: CallSignalPayload) => {
      const call = activeCallRef.current
      if (!call) {
        return
      }

      const state = ensurePeerState(call, fromUserId)
      const { pc } = state

      if (signal.type === "ice-candidate" && signal.payload) {
        const candidate = signal.payload as RTCIceCandidateInit

        if (!pc.remoteDescription) {
          state.pendingCandidates.push(candidate)
          return
        }

        try {
          await pc.addIceCandidate(candidate)
        } catch {
          // Ignore stale ICE candidates.
        }
        return
      }

      const description = signal.payload as RTCSessionDescriptionInit
      const readyForOffer =
        !state.makingOffer &&
        (pc.signalingState === "stable" || state.isSettingRemoteAnswerPending)
      const offerCollision = signal.type === "offer" && !readyForOffer

      state.ignoreOffer = !state.polite && offerCollision
      if (state.ignoreOffer) {
        return
      }

      state.isSettingRemoteAnswerPending = signal.type === "answer"

      try {
        await pc.setRemoteDescription(description)
        state.isSettingRemoteAnswerPending = false
        await flushPendingCandidates(state)

        if (signal.type === "offer") {
          await pc.setLocalDescription()
          if (!pc.localDescription || !activeCallRef.current) {
            return
          }

          await sendSignal(activeCallRef.current.id, fromUserId, {
            type: "answer",
            payload: pc.localDescription.toJSON(),
          })
        }
      } catch {
        state.isSettingRemoteAnswerPending = false
      }
    },
    [ensurePeerState, flushPendingCandidates]
  )

  const cleanupCall = useCallback(
    async (announceLeave = true) => {
      const currentCall = activeCallRef.current
      stopIncomingTone()

      if (announceLeave && currentCall) {
        await fetch(`/api/calls/${currentCall.id}/leave`, { method: "POST" }).catch(() => null)
      }

      for (const remoteUserId of [...peerStatesRef.current.keys()]) {
        destroyPeer(remoteUserId)
      }

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
      setCameraFacing("user")
      setIsMicrophoneMuted(false)
      setIsCameraDisabled(false)
      setVolumePreset("normal")
      setIsInvitePanelOpen(false)
      setSelectedInviteUserIds([])
      setIsInvitingParticipants(false)
    },
    [destroyPeer, stopIncomingTone]
  )

  const ensureLocalStream = useCallback(
    async (media: CallMediaMode) => {
      const existingStream = localStreamRef.current
      const needsVideoUpgrade = media === "video" && !existingStream?.getVideoTracks().length

      if (existingStream && !needsVideoUpgrade) {
        for (const track of existingStream.getAudioTracks()) {
          track.enabled = !isMicrophoneMuted
        }

        for (const track of existingStream.getVideoTracks()) {
          track.enabled = media === "video" && !isCameraDisabled
        }

        syncLocalStreamToPeers(existingStream)
        forceLocalStreamRender((value) => value + 1)
        return existingStream
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video:
          media === "video"
            ? {
                facingMode: cameraFacing,
              }
            : false,
      })

      if (existingStream) {
        for (const track of existingStream.getTracks()) {
          track.stop()
        }
      }

      for (const track of stream.getAudioTracks()) {
        track.enabled = !isMicrophoneMuted
      }

      for (const track of stream.getVideoTracks()) {
        track.enabled = media === "video" && !isCameraDisabled
      }

      localStreamRef.current = stream
      syncLocalStreamToPeers(stream)
      forceLocalStreamRender((value) => value + 1)
      return stream
    },
    [cameraFacing, isCameraDisabled, isMicrophoneMuted, syncLocalStreamToPeers]
  )

  async function joinCall(call: CallSnapshot) {
    setIsConnecting(true)

    try {
      await ensureIceServersLoaded()
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
      syncPeersWithCall(data.call)
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
      await ensureIceServersLoaded()
      await ensureLocalStream(media)

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

  async function rejectIncomingCall(call: CallSnapshot | null) {
    if (!call) {
      return
    }

    stopIncomingTone()
    await fetch(`/api/calls/${call.id}/reject`, { method: "POST" }).catch(() => null)
    setIncomingCall(null)
    incomingCallRef.current = null
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
    forceLocalStreamRender((value) => value + 1)
  }

  function toggleCamera() {
    const nextDisabled = !isCameraDisabled
    setIsCameraDisabled(nextDisabled)

    for (const track of localStreamRef.current?.getVideoTracks() ?? []) {
      track.enabled = !nextDisabled
    }

    syncLocalStreamToPeers(localStreamRef.current)
    forceLocalStreamRender((value) => value + 1)
  }

  async function switchCamera() {
    const currentStream = localStreamRef.current
    if (!currentStream || activeCallRef.current?.media !== "video") {
      return
    }

    const nextFacing = cameraFacing === "user" ? "environment" : "user"

    try {
      const nextMedia = await switchCameraInMediaStream({
        currentStream,
        nextFacing,
        enabled: !isCameraDisabled,
      })

      localStreamRef.current = nextMedia.stream
      syncLocalStreamToPeers(localStreamRef.current)
      setCameraFacing(nextMedia.facing)
      forceLocalStreamRender((value) => value + 1)
    } catch {
      toast.error("Не удалось переключить камеру")
    }
  }

  function toggleInviteUser(userId: number) {
    setSelectedInviteUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  async function inviteParticipantsToCall() {
    const currentCall = activeCallRef.current
    if (!currentCall || selectedInviteUserIds.length === 0 || isInvitingParticipants) {
      return
    }

    setIsInvitingParticipants(true)

    try {
      const response = await fetch(`/api/calls/${currentCall.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantIds: selectedInviteUserIds }),
      })
      const data = (await response.json().catch(() => null)) as
        | { call?: CallSnapshot; message?: string }
        | null

      if (!response.ok || !data?.call) {
        throw new Error(data?.message ?? "Не удалось пригласить участников в звонок")
      }

      setActiveCall(data.call)
      activeCallRef.current = data.call
      setIsInvitePanelOpen(false)
      setSelectedInviteUserIds([])
      toast.success("Участники приглашены в звонок")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось пригласить участников в звонок"
      )
    } finally {
      setIsInvitingParticipants(false)
    }
  }

  useEffect(() => {
    void ensureIceServersLoaded()
  }, [ensureIceServersLoaded])

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
      void cleanupCall(false)
    }
  }, [cleanupCall, stopIncomingTone])

  useEffect(() => {
    autoAnswerHandledRef.current = false
  }, [autoAnswerCallId, autoAnswerIncoming, selectedDialogId])

  useEffect(() => {
    if (!activeCall) {
      setIsInvitePanelOpen(false)
      setSelectedInviteUserIds([])
      setIsInvitingParticipants(false)
      return
    }

    syncPeersWithCall(activeCall)
  }, [activeCall, syncPeersWithCall])

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
  }, [activeCall, incomingCall, isConnecting, selectedDialogId, startRequest, startCallEffect])

  useEffect(() => {
    if (
      !autoAnswerIncoming ||
      autoAnswerHandledRef.current ||
      !incomingCall ||
      !matchesRequestedCall(incomingCall, autoAnswerCallId) ||
      activeCall ||
      isConnecting
    ) {
      return
    }

    autoAnswerHandledRef.current = true
    autoAnswerEffect(incomingCall)
  }, [activeCall, autoAnswerCallId, autoAnswerEffect, autoAnswerIncoming, incomingCall, isConnecting])

  useEffect(() => {
    const eventSource = new EventSource("/api/calls/events")

    const onEvent = (event: MessageEvent<string>) => {
      let payload: CallEvent

      try {
        payload = JSON.parse(event.data) as CallEvent
      } catch {
        return
      }

      if (payload.type === "call.snapshot") {
        const availableCalls = payload.calls.filter(
          (call) =>
            call.participants.some((participant) => participant.userId === currentUser.userId) ||
            call.invitedUsers.some((user) => user.userId === currentUser.userId)
        )
        const current =
          availableCalls.find((call) => matchesRequestedCall(call, autoAnswerCallId)) ??
          availableCalls[0] ??
          null

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
        activeCallRef.current = joined ? current : null
        setIncomingCall(joined ? null : current)
        incomingCallRef.current = joined ? null : current

        if (joined) {
          syncPeersWithCall(current)
        }
        return
      }

      if (payload.type === "call.invited") {
        if (payload.call.createdByUserId !== currentUser.userId) {
          setIncomingCall(payload.call)
          incomingCallRef.current = payload.call
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
            incomingCallRef.current = null
          }
          return
        }

        if (isMember) {
          setActiveCall(payload.call)
          activeCallRef.current = payload.call
          setIncomingCall(null)
          incomingCallRef.current = null
          syncPeersWithCall(payload.call)
        } else {
          setIncomingCall(payload.call)
          incomingCallRef.current = payload.call
        }
        return
      }

      if (payload.type === "call.ended") {
        if (
          activeCallRef.current?.id === payload.callId ||
          incomingCallRef.current?.id === payload.callId
        ) {
          toast.message("Звонок завершен")
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
  }, [autoAnswerCallId, cleanupCall, currentUser.userId, handleSignal, syncPeersWithCall])

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
  const canSwitchCamera = canToggleCamera
  const remoteVolume = VOLUME_LEVELS[volumePreset]
  const incomingCaller =
    incomingCall?.participants.find((user) => user.userId !== currentUser.userId) ??
    incomingCall?.invitedUsers.find((user) => user.userId !== currentUser.userId) ??
    currentUser

  const inviteCandidates = useMemo(() => {
    if (!activeCall) {
      return []
    }

    const excludedUserIds = new Set([
      ...activeCall.participants.map((participant) => participant.userId),
      ...activeCall.invitedUsers.map((participant) => participant.userId),
    ])

    return contacts.filter((contact) => !excludedUserIds.has(contact.userId))
  }, [activeCall, contacts])

  const isVideoCall = activeCall?.media === "video" || incomingCall?.media === "video"
  const callKindLabel = isVideoCall ? "Видеозвонок" : "Голосовой звонок"
  const callTitle = activeCall
    ? remoteTiles[0]?.user
      ? getDisplayName(remoteTiles[0].user)
      : activeDialog?.title ?? "Звонок в чате"
    : getDisplayName(incomingCaller)
  const callStatus = activeCall
    ? remoteTiles.length > 0
      ? `В звонке: ${activeCall.participants.length}`
      : activeCall.invitedUsers.length > 0
        ? "Соединяем участников..."
        : "Ожидаем подключения"
    : incomingCall
      ? `${incomingCall.media === "video" ? "Видеозвонок" : "Звонок"} от ${getDisplayName(incomingCaller)}`
      : ""
  const primaryRemoteUser =
    remoteTiles[0]?.user ??
    activeCall?.participants.find((participant) => participant.userId !== currentUser.userId) ??
    incomingCaller

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!selectedDialogId || isConnecting || Boolean(activeCall)}
          onClick={() => void startCall("audio")}
        >
          <PhoneCallIcon className="size-4" />
          Аудио
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selectedDialogId || isConnecting || Boolean(activeCall)}
          onClick={() => void startCall("video")}
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
                    variant={isInvitePanelOpen ? "secondary" : "outline"}
                    onClick={() => {
                      setIsInvitePanelOpen((prev) => !prev)
                      if (isInvitePanelOpen) {
                        setSelectedInviteUserIds([])
                      }
                    }}
                  >
                    <UserPlusIcon className="size-4" />
                    Добавить в звонок
                  </Button>
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
                  {canSwitchCamera ? (
                    <Button type="button" variant="outline" onClick={() => void switchCamera()}>
                      <RefreshCcwIcon className="size-4" />
                      Сменить камеру
                    </Button>
                  ) : null}
                  <Button type="button" variant="destructive" onClick={() => void endCurrentCall()}>
                    <PhoneOffIcon className="size-4" />
                    Завершить
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    disabled={isConnecting || !incomingCall}
                    onClick={() => incomingCall && void joinCall(incomingCall)}
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
                      Ждем, пока кто-нибудь подключится к звонку.
                    </div>
                  )}
                </div>

                <div className="flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/4 p-4">
                  <VideoTile label="Вы" user={localUser} stream={localStreamRef.current} muted />

                  <div className="mt-4 flex min-h-0 flex-1 flex-col space-y-2">
                    {isInvitePanelOpen ? (
                      <div className="space-y-3 rounded-[1.2rem] border border-white/10 bg-black/20 p-3">
                        <div>
                          <p className="text-sm font-medium text-white">Пригласить в звонок</p>
                          <p className="text-xs text-white/60">
                            Контакты добавятся только в текущий звонок, не в переписку.
                          </p>
                        </div>
                        {inviteCandidates.length > 0 ? (
                          <>
                            <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                              {inviteCandidates.map((contact) => (
                                <label
                                  key={contact.userId}
                                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-3 py-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    className="size-4 shrink-0 accent-sky-400"
                                    checked={selectedInviteUserIds.includes(contact.userId)}
                                    onChange={() => toggleInviteUser(contact.userId)}
                                  />
                                  <UserAvatar
                                    firstName={contact.firstName}
                                    lastName={contact.lastName}
                                    avatarTone={contact.avatarTone}
                                    avatarUrl={contact.avatarUrl}
                                    className="size-9 border border-white/10"
                                  />
                                  <span className="min-w-0 truncate">{getDisplayName(contact)}</span>
                                </label>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void inviteParticipantsToCall()}
                                disabled={isInvitingParticipants || selectedInviteUserIds.length === 0}
                              >
                                {isInvitingParticipants ? "Приглашаем..." : "Пригласить"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setIsInvitePanelOpen(false)
                                  setSelectedInviteUserIds([])
                                }}
                              >
                                Скрыть
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-white/60">Нет доступных контактов для приглашения.</p>
                        )}
                      </div>
                    ) : null}

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
