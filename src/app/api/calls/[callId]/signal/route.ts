import { type NextRequest, NextResponse } from "next/server"

import { getCallRecord, sendCallSignal, type CallSignalPayload } from "@/features/calls/lib/call-store"

import { getAuthorizedCallContext } from "../../_lib"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ callId: string }> }
) {
  const auth = await getAuthorizedCallContext(request)
  if ("error" in auth) {
    return auth.error
  }

  const { callId } = await context.params
  const body = (await request.json().catch(() => null)) as
    | { toUserId?: number; signal?: CallSignalPayload }
    | null

  const toUserId =
    typeof body?.toUserId === "number" && Number.isInteger(body.toUserId) && body.toUserId > 0
      ? body.toUserId
      : null
  const signal = body?.signal ?? null

  if (!toUserId || !signal) {
    return NextResponse.json({ message: "Некорректный сигнал звонка" }, { status: 400 })
  }

  const call = getCallRecord(callId)
  if (!call || !call.usersById.has(auth.userId)) {
    return NextResponse.json({ message: "Звонок не найден" }, { status: 404 })
  }

  const ok = sendCallSignal({
    callId,
    fromUserId: auth.userId,
    toUserId,
    signal,
  })

  if (!ok) {
    return NextResponse.json({ message: "Не удалось отправить сигнал" }, { status: 400 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
