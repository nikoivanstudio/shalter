import { type NextRequest, NextResponse } from "next/server"

import { joinBroadcast } from "@/features/channels/lib/broadcast-store"

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
  const broadcast = joinBroadcast(broadcastId, auth.user)
  if (!broadcast) {
    return NextResponse.json({ message: "Трансляция не найдена" }, { status: 404 })
  }

  return NextResponse.json({ broadcast }, { status: 200 })
}
