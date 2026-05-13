import { NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"

export const runtime = "nodejs"

type RoomPlayerSnapshot = {
  playerId: string
  displayName: string
  fighterId: string
  color: string
  x: number
  y: number
  hp: number
  maxHp: number
  score: number
  superReady: boolean
  updatedAt: number
}

type RoomState = {
  players: Map<string, RoomPlayerSnapshot>
  listeners: Set<(payload: string) => void>
}

type UpdateBody = {
  roomId?: string
  fighterId?: string
  displayName?: string
  color?: string
  x?: number
  y?: number
  hp?: number
  maxHp?: number
  score?: number
  superReady?: boolean
}

const rooms = new Map<string, RoomState>()
const PRESENCE_TTL_MS = 12_000

function getRoom(roomId: string) {
  let room = rooms.get(roomId)

  if (!room) {
    room = {
      players: new Map(),
      listeners: new Set(),
    }
    rooms.set(roomId, room)
  }

  return room
}

function createSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function sanitizeRoomId(roomId: string | null) {
  return roomId?.trim().slice(0, 32) || "arena"
}

function cleanupRoom(roomId: string) {
  const room = rooms.get(roomId)
  if (!room) {
    return
  }

  const cutoff = Date.now() - PRESENCE_TTL_MS

  for (const [playerId, player] of room.players.entries()) {
    if (player.updatedAt < cutoff) {
      room.players.delete(playerId)
    }
  }

  if (room.players.size === 0 && room.listeners.size === 0) {
    rooms.delete(roomId)
  }
}

function getSnapshot(roomId: string) {
  cleanupRoom(roomId)

  const room = getRoom(roomId)

  return {
    roomId,
    players: Array.from(room.players.values()).sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "ru")
    ),
  }
}

function broadcastRoom(roomId: string) {
  const room = rooms.get(roomId)
  if (!room) {
    return
  }

  const payload = createSseEvent("snapshot", getSnapshot(roomId))
  for (const listener of room.listeners) {
    listener(payload)
  }
}

export async function GET(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request, { touchActivity: false })
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const roomId = sanitizeRoomId(request.nextUrl.searchParams.get("room"))
  const room = getRoom(roomId)
  const encoder = new TextEncoder()

  let pingTimer: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false

      const send = (payload: string) => {
        if (!closed) {
          controller.enqueue(encoder.encode(payload))
        }
      }

      const listener = (payload: string) => {
        send(payload)
      }

      const close = () => {
        if (closed) {
          return
        }

        closed = true
        room.listeners.delete(listener)
        cleanupRoom(roomId)

        if (pingTimer) {
          clearInterval(pingTimer)
          pingTimer = null
        }

        try {
          controller.close()
        } catch {
          // stream can already be closed
        }

        request.signal.removeEventListener("abort", close)
      }

      room.listeners.add(listener)
      send("retry: 5000\n\n")
      send(createSseEvent("ready", { ok: true, roomId }))
      send(createSseEvent("snapshot", getSnapshot(roomId)))

      pingTimer = setInterval(() => {
        send(": ping\n\n")
        cleanupRoom(roomId)
      }, 10_000)

      request.signal.addEventListener("abort", close)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

export async function POST(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request, { touchActivity: false })
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const body = (await request.json()) as UpdateBody
  const roomId = sanitizeRoomId(body.roomId ?? null)
  const room = getRoom(roomId)
  const playerId = String(userId)

  room.players.set(playerId, {
    playerId,
    displayName: body.displayName?.trim().slice(0, 24) || `Игрок ${playerId}`,
    fighterId: body.fighterId?.trim().slice(0, 32) || "vortex",
    color: body.color?.trim().slice(0, 32) || "#38bdf8",
    x: typeof body.x === "number" ? body.x : 50,
    y: typeof body.y === "number" ? body.y : 50,
    hp: typeof body.hp === "number" ? body.hp : 100,
    maxHp: typeof body.maxHp === "number" ? body.maxHp : 100,
    score: typeof body.score === "number" ? body.score : 0,
    superReady: Boolean(body.superReady),
    updatedAt: Date.now(),
  })

  broadcastRoom(roomId)

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request, { touchActivity: false })
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const roomId = sanitizeRoomId(request.nextUrl.searchParams.get("room"))
  const room = rooms.get(roomId)
  if (room) {
    room.players.delete(String(userId))
    broadcastRoom(roomId)
    cleanupRoom(roomId)
  }

  return NextResponse.json({ ok: true })
}
