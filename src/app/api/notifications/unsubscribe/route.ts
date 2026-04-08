import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { removePushSubscription } from "@/shared/lib/notifications/push"

export async function POST(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null
  const endpoint = body?.endpoint?.trim()
  if (!endpoint) {
    return NextResponse.json({ message: "Endpoint не передан" }, { status: 400 })
  }

  await removePushSubscription(userId, endpoint)
  return NextResponse.json({ ok: true }, { status: 200 })
}
