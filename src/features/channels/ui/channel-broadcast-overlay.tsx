"use client"

import {
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  RadioIcon,
  RefreshCcwIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/shared/ui/user-avatar"

type BroadcastMediaMode = "audio" | "video"

type BroadcastUser = {
  userId: number
  firstName: string
  lastName: string | null
  email: string
  avatarTone?: string | null
  avatarUrl?: string | null
}

type BroadcastViewer = BroadcastUser & {
  joinedAt: string
}

type BroadcastSnapshot = {
  id: string
  channelId: number
  media: BroadcastMediaMode
  host: BroadcastUser
  createdAt: string
  viewers: BroadcastViewer[]
}

type BroadcastSignalPayload = {
  type: "offer" | "answer" | "ice-candidate"
  payload: unknown
}

type BroadcastEvent =
  | { type: "broadcast.snapshot"; broadcasts: BroadcastSnapshot[] }
  | { type: "broadcast.invited"; broadcast: BroadcastSnapshot }
  | { type: "broadcast.updated"; broadcast: BroadcastSnapshot }
  | { type: "broadcast.ended"; broadcastId: string }
  | {
      type: "broadcast.signal"
      broadcastId: string
      fromUserId: number
      signal: BroadcastSignalPayload
    }

type IceServerConfig = NonNullable<RTCConfiguration["iceServers"]>[number]

type ChannelMessage = {
  id: number
  channelId: number
  content: string
  createdAt: string
  author: {
    id: number
    firstName: string
    lastName: string | null
    avatarTone?: string | null
    avatarUrl?: string | null
  }
}

const DEFAULT_ICE_SERVERS: IceServerConfig[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

function getDisplayName(user: BroadcastUser) {
  return `${user.firstName} ${user.lastName ?? ""}`.trim() || user.email
}

function playMediaElement(element: HTMLMediaElement | null) {
  if (!element) {
    return
  }

  void element.play().catch(() => null)
}

export function ChannelBroadcastOverlay({
  currentUser,
  channels,
  selectedChannelId,
  canBroadcast,
}: {
  currentUser: BroadcastUser
  channels: Array<{ id: number; title: string }>
  selectedChannelId: number | null
  canBroadcast: boolean
}) {
  const [activeBroadcast, setActiveBroadcast] = useState<BroadcastSnapshot | null>(null)
  const [incomingBroadcast, setIncomingBroadcast] = useState<BroadcastSnapshot | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false)
  const [isCameraDisabled, setIsCameraDisabled] = useState(false)
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user")
  const [remoteHostStream, setRemoteHostStream] = useState<MediaStream | null>(null)
  const [iceServers, setIceServers] = useState<IceServerConfig[]>(DEFAULT_ICE_SERVERS)
  const [broadcastMessages, setBroadcastMessages] = useState<ChannelMessage[]>([])
  const [broadcastMessageText, setBroadcastMessageText] = useState("")
  const [isSendingMessage, setIsSendingMessage] = useState(false)

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef(new Map<number, RTCPeerConnection>())
  const pendingIceCandidatesRef = useRef(new Map<number, RTCIceCandidateInit[]>())
  const activeBroadcastRef = useRef<BroadcastSnapshot | null>(null)
  const incomingBroadcastRef = useRef<BroadcastSnapshot | null>(null)
  const iceServersRef = useRef<IceServerConfig[]>(DEFAULT_ICE_SERVERS)
  const iceServersRequestRef = useRef<Promise<IceServerConfig[]> | null>(null)

  const channelTitle = useMemo(() => {
    const channelId = activeBroadcast?.channelId ?? incomingBroadcast?.channelId ?? selectedChannelId
    return channels.find((channel) => channel.id === channelId)?.title ?? "Трансляция"
  }, [activeBroadcast?.channelId, channels, incomingBroadcast?.channelId, selectedChannelId])

  const isHost = activeBroadcast?.host.userId === currentUser.userId
  const showOverlay = Boolean(activeBroadcast || incomingBroadcast)
  const activeViewers = activeBroadcast?.viewers ?? []

  useEffect(() => {
    activeBroadcastRef.current = activeBroadcast
  }, [activeBroadcast])

  useEffect(() => {
    incomingBroadcastRef.current = incomingBroadcast
  }, [incomingBroadcast])

  useEffect(() => {
    iceServersRef.current = iceServers
  }, [iceServers])

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current
      playMediaElement(localVideoRef.current)
    }
  }, [activeBroadcast, isCameraDisabled])

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteHostStream
      playMediaElement(remoteVideoRef.current)
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteHostStream
      playMediaElement(remoteAudioRef.current)
    }
  }, [remoteHostStream])

  const destroyPeer = useCallback((remoteUserId: number) => {
    const peer = peerConnectionsRef.current.get(remoteUserId)
    if (peer) {
      peer.onicecandidate = null
      peer.ontrack = null
      peer.close()
      peerConnectionsRef.current.delete(remoteUserId)
    }
    pendingIceCandidatesRef.current.delete(remoteUserId)
  }, [])

  const cleanupBroadcast = useCallback(
    async (notifyServer: boolean) => {
      if (notifyServer && activeBroadcastRef.current) {
        await fetch(`/api/channel-broadcasts/${activeBroadcastRef.current.id}/leave`, {
          method: "POST",
        }).catch(() => null)
      }

      for (const peerUserId of peerConnectionsRef.current.keys()) {
        destroyPeer(peerUserId)
      }

      for (const track of localStreamRef.current?.getTracks() ?? []) {
        track.stop()
      }

      localStreamRef.current = null
      setRemoteHostStream(null)
      setIncomingBroadcast(null)
      incomingBroadcastRef.current = null
      setActiveBroadcast(null)
      activeBroadcastRef.current = null
      setIsConnecting(false)
      setIsMicrophoneMuted(false)
      setIsCameraDisabled(false)
      setCameraFacing("user")
      setBroadcastMessages([])
      setBroadcastMessageText("")
    },
    [destroyPeer]
  )

  const ensureIceServersLoaded = useCallback(async () => {
    if (!iceServersRequestRef.current) {
      iceServersRequestRef.current = fetch("/api/calls/ice")
        .then(async (response) => {
          const data = (await response.json().catch(() => null)) as
            | { iceServers?: IceServerConfig[] }
            | null

          if (!response.ok) {
            return DEFAULT_ICE_SERVERS
          }

          return Array.isArray(data?.iceServers) && data.iceServers.length > 0
            ? data.iceServers
            : DEFAULT_ICE_SERVERS
        })
        .catch(() => DEFAULT_ICE_SERVERS)
    }

    const nextIceServers = await iceServersRequestRef.current
    setIceServers(nextIceServers)
    return nextIceServers
  }, [])

  useEffect(() => {
    void ensureIceServersLoaded()
  }, [ensureIceServersLoaded])

  const ensureLocalStream = useCallback(
    async (media: BroadcastMediaMode) => {
      if (localStreamRef.current) {
        return localStreamRef.current
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

      localStreamRef.current = stream
      setIsMicrophoneMuted(false)
      setIsCameraDisabled(media !== "video")
      return stream
    },
    [cameraFacing]
  )

  async function sendSignal(broadcastId: string, toUserId: number, signal: BroadcastSignalPayload) {
    await fetch(`/api/channel-broadcasts/${broadcastId}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId, signal }),
    })
  }

  const syncLocalStreamToPeers = useCallback((stream: MediaStream | null) => {
    for (const peer of peerConnectionsRef.current.values()) {
      const audioTrack = stream?.getAudioTracks()[0] ?? null
      const videoTrack = stream?.getVideoTracks()[0] ?? null
      const audioSender = peer.getSenders().find((sender) => sender.track?.kind === "audio") ?? null
      const videoSender = peer.getSenders().find((sender) => sender.track?.kind === "video") ?? null

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

  const ensurePeerConnection = useCallback(
    (broadcast: BroadcastSnapshot, remoteUser: BroadcastUser) => {
      const existing = peerConnectionsRef.current.get(remoteUser.userId)
      if (existing) {
        return existing
      }

      const peer = new RTCPeerConnection({
        iceServers: iceServersRef.current,
      })

      if (broadcast.host.userId === currentUser.userId) {
        for (const track of localStreamRef.current?.getTracks() ?? []) {
          peer.addTrack(track, localStreamRef.current as MediaStream)
        }
      }

      peer.onicecandidate = (event) => {
        if (!event.candidate) {
          return
        }

        void sendSignal(broadcast.id, remoteUser.userId, {
          type: "ice-candidate",
          payload: event.candidate.toJSON(),
        })
      }

      peer.ontrack = (event) => {
        const remoteStream = event.streams[0] ?? null
        if (remoteStream) {
          setRemoteHostStream(remoteStream)
          return
        }

        setRemoteHostStream((prev) => {
          const next = prev ?? new MediaStream()
          if (!next.getTracks().some((track) => track.id === event.track.id)) {
            next.addTrack(event.track)
          }
          return next
        })
      }

      peerConnectionsRef.current.set(remoteUser.userId, peer)
      return peer
    },
    [currentUser.userId]
  )

  const handleSignal = useCallback(
    async (fromUserId: number, signal: BroadcastSignalPayload) => {
      const broadcast = activeBroadcastRef.current
      if (!broadcast) {
        return
      }

      const remoteUser =
        fromUserId === broadcast.host.userId
          ? broadcast.host
          : broadcast.viewers.find((viewer) => viewer.userId === fromUserId) ?? null

      if (!remoteUser) {
        return
      }

      const peer = ensurePeerConnection(broadcast, remoteUser)

      if (signal.type === "offer") {
        await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit)

        const pending = pendingIceCandidatesRef.current.get(fromUserId) ?? []
        for (const candidate of pending) {
          await peer.addIceCandidate(candidate)
        }
        pendingIceCandidatesRef.current.delete(fromUserId)

        const answer = await peer.createAnswer()
        await peer.setLocalDescription(answer)
        await sendSignal(broadcast.id, fromUserId, {
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
        const candidate = signal.payload as RTCIceCandidateInit
        if (peer.remoteDescription) {
          await peer.addIceCandidate(candidate)
        } else {
          const pending = pendingIceCandidatesRef.current.get(fromUserId) ?? []
          pending.push(candidate)
          pendingIceCandidatesRef.current.set(fromUserId, pending)
        }
      }
    },
    [ensurePeerConnection]
  )

  const createOfferForViewer = useCallback(
    async (broadcast: BroadcastSnapshot, viewer: BroadcastViewer) => {
      const peer = ensurePeerConnection(broadcast, viewer)
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      await sendSignal(broadcast.id, viewer.userId, {
        type: "offer",
        payload: offer,
      })
    },
    [ensurePeerConnection]
  )

  const createOffersForMissingViewers = useCallback(
    async (broadcast: BroadcastSnapshot) => {
      if (broadcast.host.userId !== currentUser.userId) {
        return
      }

      for (const viewer of broadcast.viewers) {
        if (peerConnectionsRef.current.has(viewer.userId)) {
          continue
        }

        await createOfferForViewer(broadcast, viewer)
      }
    },
    [createOfferForViewer, currentUser.userId]
  )

  async function joinBroadcast(broadcast: BroadcastSnapshot) {
    setIsConnecting(true)

    try {
      await ensureIceServersLoaded()
      const response = await fetch(`/api/channel-broadcasts/${broadcast.id}/join`, {
        method: "POST",
      })
      const data = (await response.json().catch(() => null)) as
        | { broadcast?: BroadcastSnapshot; message?: string }
        | null

      if (!response.ok || !data?.broadcast) {
        throw new Error(data?.message ?? "Не удалось подключиться к трансляции")
      }

      setIncomingBroadcast(null)
      incomingBroadcastRef.current = null
      setActiveBroadcast(data.broadcast)
      activeBroadcastRef.current = data.broadcast
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось подключиться к трансляции")
    } finally {
      setIsConnecting(false)
    }
  }

  async function startBroadcast(media: BroadcastMediaMode) {
    if (!selectedChannelId) {
      toast.error("Сначала откройте канал")
      return
    }

    setIsConnecting(true)

    try {
      await ensureIceServersLoaded()
      await ensureLocalStream(media)

      const response = await fetch("/api/channel-broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selectedChannelId, media }),
      })
      const data = (await response.json().catch(() => null)) as
        | { broadcast?: BroadcastSnapshot; message?: string }
        | null

      if (!response.ok || !data?.broadcast) {
        throw new Error(data?.message ?? "Не удалось запустить трансляцию")
      }

      setActiveBroadcast(data.broadcast)
      activeBroadcastRef.current = data.broadcast
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось запустить трансляцию")
      await cleanupBroadcast(false)
    } finally {
      setIsConnecting(false)
    }
  }

  async function endCurrentBroadcast() {
    const current = activeBroadcastRef.current
    if (!current) {
      return
    }

    if (current.host.userId === currentUser.userId) {
      await fetch(`/api/channel-broadcasts/${current.id}/end`, { method: "POST" }).catch(() => null)
      await cleanupBroadcast(false)
      return
    }

    await cleanupBroadcast(true)
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

  async function switchCamera() {
    const currentStream = localStreamRef.current
    if (!currentStream || activeBroadcastRef.current?.media !== "video") {
      return
    }

    const nextFacing = cameraFacing === "user" ? "environment" : "user"

    try {
      const videoDevices = await navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => devices.filter((device) => device.kind === "videoinput"))
        .catch(() => [])
      const currentTrack = currentStream.getVideoTracks()[0] ?? null
      const currentDeviceId = currentTrack?.getSettings().deviceId ?? null
      const currentDeviceIndex = videoDevices.findIndex(
        (device) => device.deviceId && device.deviceId === currentDeviceId
      )
      const nextDevice =
        videoDevices.length > 1
          ? videoDevices[
              currentDeviceIndex >= 0 ? (currentDeviceIndex + 1) % videoDevices.length : 0
            ] ?? null
          : null
      const replacementStream = await navigator.mediaDevices.getUserMedia({
        video: nextDevice?.deviceId
          ? { deviceId: { exact: nextDevice.deviceId } }
          : { facingMode: nextFacing },
      })
      const replacementTrack = replacementStream.getVideoTracks()[0] ?? null
      if (!replacementTrack) {
        throw new Error("camera")
      }

      const previousTrack = currentStream.getVideoTracks()[0] ?? null
      const audioTracks = currentStream.getAudioTracks()

      if (previousTrack) {
        currentStream.removeTrack(previousTrack)
        previousTrack.stop()
      }

      currentStream.addTrack(replacementTrack)
      if (isCameraDisabled) {
        replacementTrack.enabled = false
      }

      localStreamRef.current = new MediaStream([...audioTracks, replacementTrack])
      syncLocalStreamToPeers(localStreamRef.current)
      setCameraFacing(nextFacing)

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
        playMediaElement(localVideoRef.current)
      }
    } catch {
      toast.error("Не удалось переключить камеру")
    }
  }

  useEffect(() => {
    const eventSource = new EventSource("/api/channel-broadcasts/events")

    const onEvent = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as BroadcastEvent

      if (payload.type === "broadcast.snapshot") {
        const current =
          payload.broadcasts.find((broadcast) => broadcast.id === activeBroadcastRef.current?.id) ??
          payload.broadcasts.find((broadcast) => broadcast.id === incomingBroadcastRef.current?.id) ??
          payload.broadcasts.find((broadcast) => broadcast.channelId === selectedChannelId) ??
          payload.broadcasts[0] ??
          null

        if (!current) {
          if (activeBroadcastRef.current || incomingBroadcastRef.current) {
            void cleanupBroadcast(false)
          }
          return
        }

        const joined =
          current.host.userId === currentUser.userId ||
          current.viewers.some((viewer) => viewer.userId === currentUser.userId)

        setActiveBroadcast(joined ? current : null)
        setIncomingBroadcast(joined ? null : current)
        if (joined) {
          void createOffersForMissingViewers(current)
        }
        return
      }

      if (payload.type === "broadcast.invited") {
        if (payload.broadcast.host.userId !== currentUser.userId) {
          setIncomingBroadcast(payload.broadcast)
          toast.message(
            `В канале запущена ${payload.broadcast.media === "video" ? "видеотрансляция" : "аудиотрансляция"}`
          )
        }
        return
      }

      if (payload.type === "broadcast.updated") {
        const isHostNow = payload.broadcast.host.userId === currentUser.userId
        const isViewerNow = payload.broadcast.viewers.some((viewer) => viewer.userId === currentUser.userId)

        setActiveBroadcast((prev) =>
          prev?.id === payload.broadcast.id || isHostNow || isViewerNow ? payload.broadcast : prev
        )
        setIncomingBroadcast((prev) =>
          isHostNow || isViewerNow
            ? null
            : prev?.id === payload.broadcast.id || payload.broadcast.channelId === selectedChannelId
              ? payload.broadcast
              : prev
        )
        if (isHostNow) {
          void createOffersForMissingViewers(payload.broadcast)
        }
        return
      }

      if (payload.type === "broadcast.ended") {
        if (
          activeBroadcastRef.current?.id === payload.broadcastId ||
          incomingBroadcastRef.current?.id === payload.broadcastId
        ) {
          toast.message("Трансляция завершена")
          void cleanupBroadcast(false)
        }
        return
      }

      if (payload.type === "broadcast.signal") {
        if (activeBroadcastRef.current?.id !== payload.broadcastId) {
          return
        }

        void handleSignal(payload.fromUserId, payload.signal)
      }
    }

    eventSource.addEventListener("broadcast.snapshot", onEvent as EventListener)
    eventSource.addEventListener("broadcast.invited", onEvent as EventListener)
    eventSource.addEventListener("broadcast.updated", onEvent as EventListener)
    eventSource.addEventListener("broadcast.ended", onEvent as EventListener)
    eventSource.addEventListener("broadcast.signal", onEvent as EventListener)

    return () => {
      eventSource.close()
    }
  }, [cleanupBroadcast, createOffersForMissingViewers, currentUser.userId, handleSignal, selectedChannelId])

  useEffect(() => {
    const handlePageHide = () => {
      const current = activeBroadcastRef.current
      if (!current) {
        return
      }

      void fetch(`/api/channel-broadcasts/${current.id}/leave`, {
        method: "POST",
        keepalive: true,
      }).catch(() => null)
    }

    window.addEventListener("pagehide", handlePageHide)
    return () => {
      window.removeEventListener("pagehide", handlePageHide)
    }
  }, [])

  useEffect(() => {
    const channelId = activeBroadcast?.channelId ?? null
    if (!channelId) {
      setBroadcastMessages([])
      setBroadcastMessageText("")
      return
    }

    let cancelled = false

    const loadMessages = async () => {
      const response = await fetch(`/api/channels/${channelId}/messages`)
      const data = (await response.json().catch(() => null)) as
        | { messages?: ChannelMessage[] }
        | null

      if (!response.ok || cancelled) {
        return
      }

      setBroadcastMessages(Array.isArray(data?.messages) ? data.messages : [])
    }

    void loadMessages()
    const intervalId = window.setInterval(() => {
      void loadMessages()
    }, 3000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [activeBroadcast?.channelId])

  async function sendBroadcastMessage() {
    const channelId = activeBroadcast?.channelId ?? null
    const content = broadcastMessageText.trim()
    if (!channelId || !content || isSendingMessage) {
      return
    }

    setIsSendingMessage(true)

    try {
      const response = await fetch(`/api/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const data = (await response.json().catch(() => null)) as
        | { message?: ChannelMessage; messageText?: string }
        | { message?: string }
        | null

      if (!response.ok || !data?.message || typeof data.message === "string") {
        throw new Error(
          (data && typeof data.message === "string" ? data.message : null) ??
            "Не удалось отправить сообщение в чат трансляции"
        )
      }

      setBroadcastMessages((prev) => [...prev, data.message as ChannelMessage])
      setBroadcastMessageText("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отправить сообщение в чат трансляции")
    } finally {
      setIsSendingMessage(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!selectedChannelId || !canBroadcast || isConnecting || Boolean(activeBroadcast)}
          onClick={() => void startBroadcast("audio")}
        >
          <RadioIcon className="size-4" />
          Эфир аудио
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selectedChannelId || !canBroadcast || isConnecting || Boolean(activeBroadcast)}
          onClick={() => void startBroadcast("video")}
        >
          <VideoIcon className="size-4" />
          Эфир видео
        </Button>
      </div>

      {showOverlay ? (
        <div className="fixed inset-0 z-40 bg-slate-950/82 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 rounded-[2rem] border border-white/10 bg-slate-950/92 p-4 text-white shadow-2xl sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-sky-200/70">
                  {activeBroadcast?.media === "video" || incomingBroadcast?.media === "video"
                    ? "Видеотрансляция"
                    : "Аудиотрансляция"}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">{channelTitle}</h2>
                <p className="mt-2 text-sm text-white/70">
                  {activeBroadcast
                    ? isHost
                      ? `Зрителей в эфире: ${activeViewers.length}`
                      : `Ведущий: ${getDisplayName(activeBroadcast.host)}`
                    : `Эфир ведёт ${incomingBroadcast ? getDisplayName(incomingBroadcast.host) : ""}`}
                </p>
              </div>

              {activeBroadcast ? (
                <div className="flex flex-wrap items-center gap-2">
                  {isHost ? (
                    <>
                      <Button
                        type="button"
                        variant={isMicrophoneMuted ? "secondary" : "outline"}
                        onClick={toggleMicrophone}
                      >
                        {isMicrophoneMuted ? <MicOffIcon className="size-4" /> : <MicIcon className="size-4" />}
                        {isMicrophoneMuted ? "Микрофон выкл." : "Микрофон"}
                      </Button>
                      {activeBroadcast.media === "video" ? (
                        <Button
                          type="button"
                          variant={isCameraDisabled ? "secondary" : "outline"}
                          onClick={toggleCamera}
                        >
                          {isCameraDisabled ? <VideoOffIcon className="size-4" /> : <VideoIcon className="size-4" />}
                          {isCameraDisabled ? "Камера выкл." : "Камера"}
                        </Button>
                      ) : null}
                      {activeBroadcast.media === "video" ? (
                        <Button type="button" variant="outline" onClick={() => void switchCamera()}>
                          <RefreshCcwIcon className="size-4" />
                          Сменить камеру
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                  <Button type="button" variant="destructive" onClick={() => void endCurrentBroadcast()}>
                    <PhoneOffIcon className="size-4" />
                    {isHost ? "Завершить эфир" : "Выйти"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    disabled={isConnecting || !incomingBroadcast}
                    onClick={() => incomingBroadcast && void joinBroadcast(incomingBroadcast)}
                  >
                    <RadioIcon className="size-4" />
                    Подключиться
                  </Button>
                  <Button type="button" variant="destructive" onClick={() => setIncomingBroadcast(null)}>
                    Закрыть
                  </Button>
                </div>
              )}
            </div>

            {activeBroadcast ? (
              <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-h-0 overflow-hidden rounded-[1.6rem] border border-white/15 bg-black/30">
                  {isHost ? (
                    activeBroadcast.media === "video" ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="h-full min-h-64 w-full object-cover"
                      />
                    ) : (
                      <div className="flex min-h-64 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.24),_transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] p-6">
                        <div className="text-center">
                          <UserAvatar
                            firstName={currentUser.firstName}
                            lastName={currentUser.lastName}
                            avatarTone={currentUser.avatarTone}
                            avatarUrl={currentUser.avatarUrl}
                            className="mx-auto size-24 border border-white/20"
                            textClassName="text-2xl font-semibold"
                          />
                          <p className="mt-4 text-lg font-semibold">{getDisplayName(currentUser)}</p>
                          <p className="mt-2 text-sm text-white/70">Вы в эфире</p>
                        </div>
                      </div>
                    )
                  ) : activeBroadcast.media === "video" ? (
                    <>
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="h-full min-h-64 w-full object-cover"
                      />
                      <audio ref={remoteAudioRef} autoPlay playsInline />
                    </>
                  ) : (
                    <>
                      <div className="flex min-h-64 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.24),_transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] p-6">
                        <div className="text-center">
                          <UserAvatar
                            firstName={activeBroadcast.host.firstName}
                            lastName={activeBroadcast.host.lastName}
                            avatarTone={activeBroadcast.host.avatarTone}
                            avatarUrl={activeBroadcast.host.avatarUrl}
                            className="mx-auto size-24 border border-white/20"
                            textClassName="text-2xl font-semibold"
                          />
                          <p className="mt-4 text-lg font-semibold">{getDisplayName(activeBroadcast.host)}</p>
                          <p className="mt-2 text-sm text-white/70">Прямой эфир</p>
                        </div>
                      </div>
                      <audio ref={remoteAudioRef} autoPlay playsInline />
                    </>
                  )}
                </div>

                <div className="grid min-h-0 gap-4 lg:grid-rows-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
                  <div className="flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/4 p-4">
                    <p className="text-sm font-medium text-white/80">
                      {isHost ? "Зрители" : "Сейчас в эфире"}
                    </p>
                    <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                      {isHost ? (
                        activeViewers.length > 0 ? (
                          activeViewers.map((viewer) => (
                            <div
                              key={viewer.userId}
                              className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-3 py-2"
                            >
                              <UserAvatar
                                firstName={viewer.firstName}
                                lastName={viewer.lastName}
                                avatarTone={viewer.avatarTone}
                                avatarUrl={viewer.avatarUrl}
                                className="size-10 border border-white/10"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{getDisplayName(viewer)}</p>
                                <p className="text-xs text-white/60">Слушает эфир</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-white/70">
                            Пока никто не подключился к трансляции.
                          </div>
                        )
                      ) : (
                        <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-3 py-2">
                          <UserAvatar
                            firstName={activeBroadcast.host.firstName}
                            lastName={activeBroadcast.host.lastName}
                            avatarTone={activeBroadcast.host.avatarTone}
                            avatarUrl={activeBroadcast.host.avatarUrl}
                            className="size-10 border border-white/10"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{getDisplayName(activeBroadcast.host)}</p>
                            <p className="text-xs text-white/60">Ведущий</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white/80">Чат трансляции</p>
                      <span className="text-xs text-white/50">{broadcastMessages.length}</span>
                    </div>
                    <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                      {broadcastMessages.length > 0 ? (
                        broadcastMessages.map((message) => (
                          <div
                            key={message.id}
                            className="rounded-2xl border border-white/8 bg-white/4 px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                firstName={message.author.firstName}
                                lastName={message.author.lastName}
                                avatarTone={message.author.avatarTone}
                                avatarUrl={message.author.avatarUrl}
                                className="size-8 border border-white/10"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-white/90">
                                  {`${message.author.firstName} ${message.author.lastName ?? ""}`.trim()}
                                </p>
                                <p className="text-[11px] text-white/50">
                                  {new Date(message.createdAt).toLocaleTimeString("ru-RU", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                            <p className="mt-2 break-words text-sm text-white/80">{message.content}</p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-white/70">
                          Чат пуст. Напишите первое сообщение в эфире.
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        value={broadcastMessageText}
                        onChange={(event) => setBroadcastMessageText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault()
                            void sendBroadcastMessage()
                          }
                        }}
                        placeholder="Сообщение в чат трансляции"
                        className="flex-1 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white outline-none placeholder:text-white/35"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSendingMessage || !broadcastMessageText.trim()}
                        onClick={() => void sendBroadcastMessage()}
                      >
                        {isSendingMessage ? "..." : "Отправить"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="w-full max-w-md rounded-[1.8rem] border border-white/10 bg-white/4 p-6 text-center">
                  <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-sky-400/12 text-sky-200">
                    {incomingBroadcast?.media === "video" ? (
                      <VideoIcon className="size-9" />
                    ) : (
                      <RadioIcon className="size-9" />
                    )}
                  </div>
                  <p className="mt-4 text-xl font-semibold">
                    {incomingBroadcast ? getDisplayName(incomingBroadcast.host) : ""}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    {incomingBroadcast?.media === "video"
                      ? "Запустил видеотрансляцию в канале"
                      : "Запустил аудиотрансляцию в канале"}
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
