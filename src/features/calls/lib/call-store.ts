import type { EmblemToneId } from "@/features/profile/lib/emblem"

export type CallMediaMode = "audio" | "video"

export type CallUser = {
  userId: number
  firstName: string
  lastName: string | null
  email: string
  avatarTone?: EmblemToneId | string | null
  avatarUrl?: string | null
}

export type CallParticipant = CallUser & {
  joinedAt: string
}

export type CallSnapshot = {
  id: string
  dialogId: number
  media: CallMediaMode
  createdByUserId: number
  createdAt: string
  participants: CallParticipant[]
  invitedUsers: CallUser[]
}

export type CallSignalPayload = {
  type: "offer" | "answer" | "ice-candidate"
  payload: unknown
}

export type CallServerEvent =
  | { type: "call.snapshot"; calls: CallSnapshot[] }
  | { type: "call.invited"; call: CallSnapshot }
  | { type: "call.updated"; call: CallSnapshot }
  | { type: "call.ended"; callId: string }
  | { type: "call.signal"; callId: string; fromUserId: number; signal: CallSignalPayload }

type CallRecord = {
  id: string
  dialogId: number
  media: CallMediaMode
  createdByUserId: number
  createdAt: string
  usersById: Map<number, CallUser>
  participantsById: Map<number, CallParticipant>
}

type Listener = (event: CallServerEvent) => void

type CallStore = {
  calls: Map<string, CallRecord>
  listenersByUserId: Map<number, Set<Listener>>
}

declare global {
  var __shalterCallStore: CallStore | undefined
}

function getStore(): CallStore {
  if (!globalThis.__shalterCallStore) {
    globalThis.__shalterCallStore = {
      calls: new Map(),
      listenersByUserId: new Map(),
    }
  }

  return globalThis.__shalterCallStore
}

function callToSnapshot(call: CallRecord): CallSnapshot {
  const participants = Array.from(call.participantsById.values()).sort(
    (left, right) => left.userId - right.userId
  )
  const invitedUsers = Array.from(call.usersById.values())
    .filter((user) => !call.participantsById.has(user.userId))
    .sort((left, right) => left.userId - right.userId)

  return {
    id: call.id,
    dialogId: call.dialogId,
    media: call.media,
    createdByUserId: call.createdByUserId,
    createdAt: call.createdAt,
    participants,
    invitedUsers,
  }
}

function emitToUser(userId: number, event: CallServerEvent) {
  const store = getStore()
  const listeners = store.listenersByUserId.get(userId)
  if (!listeners) {
    return
  }

  for (const listener of listeners) {
    listener(event)
  }
}

function emitToDialogUsers(call: CallRecord, event: CallServerEvent) {
  for (const userId of call.usersById.keys()) {
    emitToUser(userId, event)
  }
}

export function subscribeToCalls(userId: number, listener: Listener) {
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

export function getUserCallSnapshots(userId: number) {
  const store = getStore()
  return Array.from(store.calls.values())
    .filter((call) => call.usersById.has(userId))
    .map(callToSnapshot)
}

export function getCallSnapshot(callId: string) {
  const call = getStore().calls.get(callId)
  return call ? callToSnapshot(call) : null
}

export function getCallRecord(callId: string) {
  return getStore().calls.get(callId) ?? null
}

export function getActiveCallForDialog(dialogId: number) {
  for (const call of getStore().calls.values()) {
    if (call.dialogId === dialogId) {
      return call
    }
  }

  return null
}

export function createCall(input: {
  dialogId: number
  media: CallMediaMode
  createdBy: CallUser
  users: CallUser[]
}) {
  const existing = getActiveCallForDialog(input.dialogId)
  if (existing) {
    return callToSnapshot(existing)
  }

  const store = getStore()
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  const call: CallRecord = {
    id,
    dialogId: input.dialogId,
    media: input.media,
    createdByUserId: input.createdBy.userId,
    createdAt,
    usersById: new Map(input.users.map((user) => [user.userId, user])),
    participantsById: new Map(),
  }

  store.calls.set(id, call)
  const snapshot = callToSnapshot(call)
  emitToDialogUsers(call, { type: "call.invited", call: snapshot })
  return snapshot
}

export function joinCall(callId: string, user: CallUser) {
  const call = getStore().calls.get(callId)
  if (!call || !call.usersById.has(user.userId)) {
    return null
  }

  if (!call.participantsById.has(user.userId)) {
    call.participantsById.set(user.userId, {
      ...user,
      joinedAt: new Date().toISOString(),
    })
  }

  const snapshot = callToSnapshot(call)
  emitToDialogUsers(call, { type: "call.updated", call: snapshot })
  return snapshot
}

export function leaveCall(callId: string, userId: number) {
  const call = getStore().calls.get(callId)
  if (!call) {
    return false
  }

  call.participantsById.delete(userId)
  if (call.participantsById.size === 0) {
    endCall(callId)
    return true
  }

  emitToDialogUsers(call, { type: "call.updated", call: callToSnapshot(call) })
  return true
}

export function endCall(callId: string) {
  const store = getStore()
  const call = store.calls.get(callId)
  if (!call) {
    return false
  }

  store.calls.delete(callId)
  emitToDialogUsers(call, { type: "call.ended", callId })
  return true
}

export function sendCallSignal(input: {
  callId: string
  fromUserId: number
  toUserId: number
  signal: CallSignalPayload
}) {
  const call = getStore().calls.get(input.callId)
  if (!call) {
    return false
  }

  if (!call.usersById.has(input.fromUserId) || !call.usersById.has(input.toUserId)) {
    return false
  }

  emitToUser(input.toUserId, {
    type: "call.signal",
    callId: input.callId,
    fromUserId: input.fromUserId,
    signal: input.signal,
  })

  return true
}
