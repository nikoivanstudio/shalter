import { type NextRequest, NextResponse } from "next/server"

import { getCallRecord, rejectCall } from "@/features/calls/lib/call-store"

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
  const call = getCallRecord(callId)
  if (!call || !call.usersById.has(auth.userId)) {
    return NextResponse.json({ message: "Звонок не найден" }, { status: 404 })
  }

  const ok = rejectCall(callId, auth.userId)
  if (!ok) {
    return NextResponse.json({ message: "Не удалось отклонить звонок" }, { status: 400 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
