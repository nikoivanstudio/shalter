import type { EmblemToneId } from "@/features/profile/lib/emblem"

export type BroadcastMediaMode = "audio" | "video"

export type BroadcastUser = {
  userId: number
  firstName: string
  lastName: string | null
  email: string
  avatarTone?: EmblemToneId | string | null
  avatarUrl?: string | null
}

export type BroadcastViewer = BroadcastUser & {
  joinedAt: string
}

export type BroadcastSnapshot = {
  id: string
  channelId: number
  media: BroadcastMediaMode
  host: BroadcastUser
  createdAt: string
  viewers: BroadcastViewer[]
}

export type BroadcastSignalPayload = {
  type: "offer" | "answer" | "ice-candidate"
  payload: unknown
}

export type BroadcastServerEvent =
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

type BroadcastRecord = {
  id: string
  channelId: number
  media: BroadcastMediaMode
  host: BroadcastUser
  createdAt: string
  membersById: Map<number, BroadcastUser>
  viewersById: Map<number, BroadcastViewer>
}

type Listener = (event: BroadcastServerEvent) => void

type BroadcastStore = {
  broadcasts: Map<string, BroadcastRecord>
  listenersByUserId: Map<number, Set<Listener>>
}

declare global {
  var __shalterBroadcastStore: BroadcastStore | undefined
}

function getStore(): BroadcastStore {
  if (!globalThis.__shalterBroadcastStore) {
    globalThis.__shalterBroadcastStore = {
      broadcasts: new Map(),
      listenersByUserId: new Map(),
    }
  }

  return globalThis.__shalterBroadcastStore
}

function toSnapshot(record: BroadcastRecord): BroadcastSnapshot {
  return {
    id: record.id,
    channelId: record.channelId,
    media: record.media,
    host: record.host,
    createdAt: record.createdAt,
    viewers: Array.from(record.viewersById.values()).sort((left, right) => left.userId - right.userId),
  }
}

function emitToUser(userId: number, event: BroadcastServerEvent) {
  const listeners = getStore().listenersByUserId.get(userId)
  if (!listeners) {
    return
  }

  for (const listener of listeners) {
    listener(event)
  }
}

function emitToMembers(record: BroadcastRecord, event: BroadcastServerEvent) {
  for (const userId of record.membersById.keys()) {
    emitToUser(userId, event)
  }
}

export function subscribeToBroadcasts(userId: number, listener: Listener) {
  const store = getStore()
  const listeners = store.listenersByUserId.get(userId) ?? new Set<Listener>()
  listeners.add(listener)
  store.listenersByUserId.set(userId, listeners)

  return () => {
    const current = store.listenersByUserId.get(userId)
    if (!current) {
      return
    }
    current.delete(listener)
    if (current.size === 0) {
      store.listenersByUserId.delete(userId)
    }
  }
}

export function getUserBroadcastSnapshots(userId: number) {
  return Array.from(getStore().broadcasts.values())
    .filter((record) => record.membersById.has(userId))
    .map(toSnapshot)
}

export function getActiveBroadcastForChannel(channelId: number) {
  for (const record of getStore().broadcasts.values()) {
    if (record.channelId === channelId) {
      return record
    }
  }

  return null
}

export function getBroadcastRecord(broadcastId: string) {
  return getStore().broadcasts.get(broadcastId) ?? null
}

export function createBroadcast(input: {
  channelId: number
  media: BroadcastMediaMode
  host: BroadcastUser
  members: BroadcastUser[]
}) {
  const existing = getActiveBroadcastForChannel(input.channelId)
  if (existing) {
    return toSnapshot(existing)
  }

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const record: BroadcastRecord = {
    id,
    channelId: input.channelId,
    media: input.media,
    host: input.host,
    createdAt,
    membersById: new Map(input.members.map((member) => [member.userId, member])),
    viewersById: new Map(),
  }

  getStore().broadcasts.set(id, record)
  const snapshot = toSnapshot(record)
  emitToMembers(record, { type: "broadcast.invited", broadcast: snapshot })
  return snapshot
}

export function joinBroadcast(broadcastId: string, user: BroadcastUser) {
  const record = getBroadcastRecord(broadcastId)
  if (!record || !record.membersById.has(user.userId)) {
    return null
  }

  if (user.userId !== record.host.userId && !record.viewersById.has(user.userId)) {
    record.viewersById.set(user.userId, {
      ...user,
      joinedAt: new Date().toISOString(),
    })
  }

  const snapshot = toSnapshot(record)
  emitToMembers(record, { type: "broadcast.updated", broadcast: snapshot })
  return snapshot
}

export function leaveBroadcast(broadcastId: string, userId: number) {
  const record = getBroadcastRecord(broadcastId)
  if (!record) {
    return false
  }

  if (record.host.userId === userId) {
    return endBroadcast(broadcastId)
  }

  record.viewersById.delete(userId)
  emitToMembers(record, { type: "broadcast.updated", broadcast: toSnapshot(record) })
  return true
}

export function endBroadcast(broadcastId: string) {
  const store = getStore()
  const record = store.broadcasts.get(broadcastId)
  if (!record) {
    return false
  }

  store.broadcasts.delete(broadcastId)
  emitToMembers(record, { type: "broadcast.ended", broadcastId })
  return true
}

export function sendBroadcastSignal(input: {
  broadcastId: string
  fromUserId: number
  toUserId: number
  signal: BroadcastSignalPayload
}) {
  const record = getBroadcastRecord(input.broadcastId)
  if (!record) {
    return false
  }

  if (!record.membersById.has(input.fromUserId) || !record.membersById.has(input.toUserId)) {
    return false
  }

  emitToUser(input.toUserId, {
    type: "broadcast.signal",
    broadcastId: input.broadcastId,
    fromUserId: input.fromUserId,
    signal: input.signal,
  })

  return true
}
