import { type NextRequest, NextResponse } from "next/server"

import {
  endBroadcast,
  getBroadcastRecord,
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
  const broadcast = getBroadcastRecord(broadcastId)
  if (!broadcast) {
    return NextResponse.json({ message: "Трансляция не найдена" }, { status: 404 })
  }

  if (broadcast.host.userId !== auth.userId) {
    return NextResponse.json(
      { message: "Завершить трансляцию может только ведущий" },
      { status: 403 }
    )
  }

  endBroadcast(broadcastId)
  return NextResponse.json({ ok: true }, { status: 200 })
}
