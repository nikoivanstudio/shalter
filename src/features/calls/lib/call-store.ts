import type { Pool, PoolClient } from "pg"

import type { EmblemToneId } from "@/features/profile/lib/emblem"
import { getPgPool } from "@/shared/lib/db/prisma"

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

export type CallRecord = {
  id: string
  dialogId: number
  media: CallMediaMode
  createdByUserId: number
  createdAt: string
  usersById: Map<number, CallUser>
  participantsById: Map<number, CallParticipant>
}

type CallRow = {
  id: string
  dialog_id: number
  media: string
  created_by_user_id: number
  created_at: Date | string
  users_json: unknown
  participants_json: unknown
}

type CallEventRow = {
  sequence: string | number
  payload_json: unknown
}

type CallEventCursorRow = {
  latest_sequence: string | number | null
}

const CALL_LOCK_NAMESPACE = 904210

let ensureTablesPromise: Promise<void> | null = null

function getPool() {
  return getPgPool()
}

async function ensureRuntimeTables() {
  if (ensureTablesPromise) {
    return ensureTablesPromise
  }

  ensureTablesPromise = (async () => {
    const pool = getPool()
    await pool.query(`
      CREATE TABLE IF NOT EXISTS runtime_calls (
        id text PRIMARY KEY,
        dialog_id integer NOT NULL,
        media text NOT NULL,
        created_by_user_id integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        users_json jsonb NOT NULL,
        participants_json jsonb NOT NULL,
        ended_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS runtime_calls_active_dialog_idx
      ON runtime_calls (dialog_id)
      WHERE ended_at IS NULL
    `)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS runtime_call_events (
        sequence bigserial PRIMARY KEY,
        user_id integer NOT NULL,
        payload_json jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS runtime_call_events_user_sequence_idx
      ON runtime_call_events (user_id, sequence)
    `)
  })()

  return ensureTablesPromise
}

function normalizeUser(value: unknown): CallUser | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const user = value as Record<string, unknown>
  const userId = typeof user.userId === "number" ? user.userId : null
  const firstName = typeof user.firstName === "string" ? user.firstName : null
  const lastName =
    typeof user.lastName === "string" || user.lastName === null ? user.lastName : null
  const email = typeof user.email === "string" ? user.email : null

  if (!userId || !firstName || !email) {
    return null
  }

  return {
    userId,
    firstName,
    lastName,
    email,
    avatarTone:
      typeof user.avatarTone === "string" || user.avatarTone === null ? user.avatarTone : null,
    avatarUrl: typeof user.avatarUrl === "string" || user.avatarUrl === null ? user.avatarUrl : null,
  }
}

function normalizeParticipant(value: unknown): CallParticipant | null {
  const user = normalizeUser(value)
  if (!user || !value || typeof value !== "object") {
    return null
  }

  const maybeJoinedAt = (value as Record<string, unknown>).joinedAt
  const joinedAt = typeof maybeJoinedAt === "string" ? maybeJoinedAt : null

  if (!joinedAt) {
    return null
  }

  return {
    ...user,
    joinedAt,
  }
}

function normalizeUserList(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map(normalizeUser).filter((item): item is CallUser => Boolean(item))
}

function normalizeParticipantList(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(normalizeParticipant)
    .filter((item): item is CallParticipant => Boolean(item))
    .sort((left, right) => left.userId - right.userId)
}

function callRowToRecord(row: CallRow): CallRecord {
  const users = normalizeUserList(row.users_json).sort((left, right) => left.userId - right.userId)
  const participants = normalizeParticipantList(row.participants_json)

  return {
    id: row.id,
    dialogId: row.dialog_id,
    media: row.media === "video" ? "video" : "audio",
    createdByUserId: row.created_by_user_id,
    createdAt:
      typeof row.created_at === "string" ? row.created_at : new Date(row.created_at).toISOString(),
    usersById: new Map(users.map((user) => [user.userId, user])),
    participantsById: new Map(participants.map((participant) => [participant.userId, participant])),
  }
}

function callToSnapshot(record: CallRecord): CallSnapshot {
  const participants = Array.from(record.participantsById.values()).sort(
    (left, right) => left.userId - right.userId
  )
  const invitedUsers = Array.from(record.usersById.values())
    .filter((user) => !record.participantsById.has(user.userId))
    .sort((left, right) => left.userId - right.userId)

  return {
    id: record.id,
    dialogId: record.dialogId,
    media: record.media,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    participants,
    invitedUsers,
  }
}

function recordToJson(record: CallRecord) {
  return {
    users: Array.from(record.usersById.values()).sort((left, right) => left.userId - right.userId),
    participants: Array.from(record.participantsById.values()).sort(
      (left, right) => left.userId - right.userId
    ),
  }
}

async function withClient<T>(callback: (client: PoolClient) => Promise<T>) {
  await ensureRuntimeTables()
  const client = await getPool().connect()

  try {
    return await callback(client)
  } finally {
    client.release()
  }
}

async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  return withClient(async (client) => {
    await client.query("BEGIN")

    try {
      const result = await callback(client)
      await client.query("COMMIT")
      return result
    } catch (error) {
      await client.query("ROLLBACK").catch(() => null)
      throw error
    }
  })
}

async function lockDialog(client: PoolClient, dialogId: number) {
  await client.query("SELECT pg_advisory_xact_lock($1, $2)", [CALL_LOCK_NAMESPACE, dialogId])
}

async function loadCallRowById(
  client: PoolClient | Pool,
  callId: string,
  { forUpdate = false }: { forUpdate?: boolean } = {}
) {
  const suffix = forUpdate ? " FOR UPDATE" : ""
  const result = await client.query<CallRow>(
    `SELECT id, dialog_id, media, created_by_user_id, created_at, users_json, participants_json
     FROM runtime_calls
     WHERE id = $1 AND ended_at IS NULL${suffix}`,
    [callId]
  )

  return result.rows[0] ?? null
}

async function loadActiveCallRowForDialog(
  client: PoolClient | Pool,
  dialogId: number,
  { forUpdate = false }: { forUpdate?: boolean } = {}
) {
  const suffix = forUpdate ? " FOR UPDATE" : ""
  const result = await client.query<CallRow>(
    `SELECT id, dialog_id, media, created_by_user_id, created_at, users_json, participants_json
     FROM runtime_calls
     WHERE dialog_id = $1 AND ended_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1${suffix}`,
    [dialogId]
  )

  return result.rows[0] ?? null
}

async function saveCallRecord(client: PoolClient, record: CallRecord) {
  const payload = recordToJson(record)

  await client.query(
    `UPDATE runtime_calls
     SET users_json = $2::jsonb,
         participants_json = $3::jsonb,
         updated_at = now()
     WHERE id = $1`,
    [record.id, JSON.stringify(payload.users), JSON.stringify(payload.participants)]
  )
}

async function enqueueEventsForUsers(
  client: PoolClient,
  userIds: Iterable<number>,
  event: CallServerEvent
) {
  const uniqueUserIds = [...new Set(Array.from(userIds).filter((userId) => userId > 0))]
  if (uniqueUserIds.length === 0) {
    return
  }

  const payload = JSON.stringify(event)
  const valuePlaceholders = uniqueUserIds
    .map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2}::jsonb)`)
    .join(", ")
  const values = uniqueUserIds.flatMap((userId) => [userId, payload])

  await client.query(
    `INSERT INTO runtime_call_events (user_id, payload_json) VALUES ${valuePlaceholders}`,
    values
  )
}

function getCallUserIds(record: CallRecord) {
  return Array.from(record.usersById.keys())
}

export async function getUserCallSnapshots(userId: number) {
  await ensureRuntimeTables()

  const result = await getPool().query<CallRow>(
    `SELECT id, dialog_id, media, created_by_user_id, created_at, users_json, participants_json
     FROM runtime_calls
     WHERE ended_at IS NULL
     ORDER BY created_at DESC`
  )

  return result.rows
    .map(callRowToRecord)
    .filter((record) => record.usersById.has(userId))
    .map(callToSnapshot)
}

export async function getCallSnapshot(callId: string) {
  await ensureRuntimeTables()
  const row = await loadCallRowById(getPool(), callId)
  return row ? callToSnapshot(callRowToRecord(row)) : null
}

export async function getCallRecord(callId: string) {
  await ensureRuntimeTables()
  const row = await loadCallRowById(getPool(), callId)
  return row ? callRowToRecord(row) : null
}

export async function getActiveCallForDialog(dialogId: number) {
  await ensureRuntimeTables()
  const row = await loadActiveCallRowForDialog(getPool(), dialogId)
  return row ? callRowToRecord(row) : null
}

export async function createCall(input: {
  dialogId: number
  media: CallMediaMode
  createdBy: CallUser
  users: CallUser[]
}) {
  return withTransaction(async (client) => {
    await lockDialog(client, input.dialogId)

    const existing = await loadActiveCallRowForDialog(client, input.dialogId, { forUpdate: true })
    if (existing) {
      return callToSnapshot(callRowToRecord(existing))
    }

    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    const users = input.users
      .slice()
      .sort((left, right) => left.userId - right.userId)
      .filter((user, index, list) => list.findIndex((item) => item.userId === user.userId) === index)
    const participants: CallParticipant[] = [
      {
        ...input.createdBy,
        joinedAt: createdAt,
      },
    ]

    await client.query(
      `INSERT INTO runtime_calls (
        id,
        dialog_id,
        media,
        created_by_user_id,
        created_at,
        users_json,
        participants_json,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5::timestamptz, $6::jsonb, $7::jsonb, now())`,
      [
        id,
        input.dialogId,
        input.media,
        input.createdBy.userId,
        createdAt,
        JSON.stringify(users),
        JSON.stringify(participants),
      ]
    )

    const record = callRowToRecord({
      id,
      dialog_id: input.dialogId,
      media: input.media,
      created_by_user_id: input.createdBy.userId,
      created_at: createdAt,
      users_json: users,
      participants_json: participants,
    })
    const snapshot = callToSnapshot(record)

    await enqueueEventsForUsers(client, getCallUserIds(record), {
      type: "call.invited",
      call: snapshot,
    })

    return snapshot
  })
}

export async function joinCall(callId: string, user: CallUser) {
  return withTransaction(async (client) => {
    const row = await loadCallRowById(client, callId, { forUpdate: true })
    if (!row) {
      return null
    }

    const record = callRowToRecord(row)
    if (!record.usersById.has(user.userId)) {
      return null
    }

    if (!record.participantsById.has(user.userId)) {
      record.participantsById.set(user.userId, {
        ...user,
        joinedAt: new Date().toISOString(),
      })
      await saveCallRecord(client, record)
    }

    const snapshot = callToSnapshot(record)
    await enqueueEventsForUsers(client, getCallUserIds(record), {
      type: "call.updated",
      call: snapshot,
    })

    return snapshot
  })
}

export async function inviteUsersToCall(callId: string, users: CallUser[]) {
  return withTransaction(async (client) => {
    const row = await loadCallRowById(client, callId, { forUpdate: true })
    if (!row) {
      return null
    }

    const record = callRowToRecord(row)
    let changed = false

    for (const user of users) {
      if (record.usersById.has(user.userId)) {
        continue
      }

      record.usersById.set(user.userId, user)
      changed = true
    }

    if (!changed) {
      return callToSnapshot(record)
    }

    await saveCallRecord(client, record)
    const snapshot = callToSnapshot(record)
    await enqueueEventsForUsers(client, getCallUserIds(record), {
      type: "call.updated",
      call: snapshot,
    })

    return snapshot
  })
}

export async function leaveCall(callId: string, userId: number) {
  return withTransaction(async (client) => {
    const row = await loadCallRowById(client, callId, { forUpdate: true })
    if (!row) {
      return false
    }

    const record = callRowToRecord(row)
    record.participantsById.delete(userId)

    if (record.participantsById.size === 0) {
      await client.query(
        `UPDATE runtime_calls
         SET ended_at = now(),
             updated_at = now()
         WHERE id = $1`,
        [callId]
      )
      await enqueueEventsForUsers(client, getCallUserIds(record), {
        type: "call.ended",
        callId,
      })
      return true
    }

    await saveCallRecord(client, record)
    await enqueueEventsForUsers(client, getCallUserIds(record), {
      type: "call.updated",
      call: callToSnapshot(record),
    })
    return true
  })
}

export async function rejectCall(callId: string, userId: number) {
  return withTransaction(async (client) => {
    const row = await loadCallRowById(client, callId, { forUpdate: true })
    if (!row) {
      return false
    }

    const record = callRowToRecord(row)
    if (!record.usersById.has(userId)) {
      return false
    }

    record.usersById.delete(userId)
    record.participantsById.delete(userId)

    if (record.usersById.size === 0 || record.participantsById.size === 0) {
      await client.query(
        `UPDATE runtime_calls
         SET ended_at = now(),
             updated_at = now()
         WHERE id = $1`,
        [callId]
      )
      await enqueueEventsForUsers(client, getCallUserIds(record), {
        type: "call.ended",
        callId,
      })
      return true
    }

    await saveCallRecord(client, record)
    await enqueueEventsForUsers(client, getCallUserIds(record), {
      type: "call.updated",
      call: callToSnapshot(record),
    })
    return true
  })
}

export async function endCall(callId: string) {
  return withTransaction(async (client) => {
    const row = await loadCallRowById(client, callId, { forUpdate: true })
    if (!row) {
      return false
    }

    const record = callRowToRecord(row)
    await client.query(
      `UPDATE runtime_calls
       SET ended_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [callId]
    )
    await enqueueEventsForUsers(client, getCallUserIds(record), {
      type: "call.ended",
      callId,
    })
    return true
  })
}

export async function sendCallSignal(input: {
  callId: string
  fromUserId: number
  toUserId: number
  signal: CallSignalPayload
}) {
  return withTransaction(async (client) => {
    const row = await loadCallRowById(client, input.callId, { forUpdate: true })
    if (!row) {
      return false
    }

    const record = callRowToRecord(row)
    if (!record.usersById.has(input.fromUserId) || !record.usersById.has(input.toUserId)) {
      return false
    }

    await enqueueEventsForUsers(client, [input.toUserId], {
      type: "call.signal",
      callId: input.callId,
      fromUserId: input.fromUserId,
      signal: input.signal,
    })

    return true
  })
}

export async function getCurrentCallEventCursor(userId: number) {
  await ensureRuntimeTables()

  const result = await getPool().query<CallEventCursorRow>(
    `SELECT MAX(sequence) AS latest_sequence
     FROM runtime_call_events
     WHERE user_id = $1`,
    [userId]
  )

  const value = result.rows[0]?.latest_sequence
  return typeof value === "string" ? Number(value) : (value ?? 0)
}

export async function getCallEventsSince(userId: number, afterSequence: number) {
  await ensureRuntimeTables()

  const result = await getPool().query<CallEventRow>(
    `SELECT sequence, payload_json
     FROM runtime_call_events
     WHERE user_id = $1 AND sequence > $2
     ORDER BY sequence ASC`,
    [userId, afterSequence]
  )

  return result.rows
    .map((row) => {
      const payload =
        typeof row.payload_json === "string"
          ? (JSON.parse(row.payload_json) as CallServerEvent)
          : (row.payload_json as CallServerEvent)

      return {
        sequence: typeof row.sequence === "string" ? Number(row.sequence) : row.sequence,
        event: payload,
      }
    })
    .filter((entry) => Number.isFinite(entry.sequence) && entry.event && typeof entry.event === "object")
}
