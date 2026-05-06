import { type NextRequest, NextResponse } from "next/server"

import {
  getBroadcastRecord,
  sendBroadcastSignal,
  type BroadcastSignalPayload,
} from "@/features/channels/lib/broadcast-store"

import { getAuthorizedBroadcastContext } from "../../_lib"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ broadcastId: string }> }
) {
  const auth = await getAuthorizedBroadcastContext(request)
  if ("error" in auth) {
    return auth.error
  }

  const { broadcastId } = await context.params
  const body = (await request.json().catch(() => null)) as
    | { toUserId?: number; signal?: BroadcastSignalPayload }
    | null

  const toUserId =
    typeof body?.toUserId === "number" && Number.isInteger(body.toUserId) && body.toUserId > 0
      ? body.toUserId
      : null

  if (!toUserId || !body?.signal) {
    return NextResponse.json({ message: "Некорректный сигнал" }, { status: 400 })
  }

  const broadcast = getBroadcastRecord(broadcastId)
  if (!broadcast || !broadcast.membersById.has(auth.userId)) {
    return NextResponse.json({ message: "Трансляция не найдена" }, { status: 404 })
  }

  const ok = sendBroadcastSignal({
    broadcastId,
    fromUserId: auth.userId,
    toUserId,
    signal: body.signal,
  })

  if (!ok) {
    return NextResponse.json({ message: "Не удалось передать сигнал" }, { status: 400 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
