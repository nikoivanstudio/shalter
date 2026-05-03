import { type NextRequest, NextResponse } from "next/server"

import { joinCall } from "@/features/calls/lib/call-store"

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
  const call = joinCall(callId, auth.user)
  if (!call) {
    return NextResponse.json({ message: "Звонок не найден" }, { status: 404 })
  }

  return NextResponse.json({ call }, { status: 200 })
}
