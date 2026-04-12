import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import {
  getPushConfigurationError,
  isPushConfigured,
  savePushSubscription,
} from "@/shared/lib/notifications/push"

export async function POST(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  if (!isPushConfigured()) {
    return NextResponse.json(
      { message: getPushConfigurationError() ?? "Push уведомления не настроены на сервере" },
      { status: 503 }
    )
  }

  const subscription = await request.json().catch(() => null)
  if (!subscription) {
    return NextResponse.json({ message: "Некорректные данные подписки" }, { status: 400 })
  }

  try {
    await savePushSubscription(userId, subscription)
  } catch {
    return NextResponse.json({ message: "Некорректные данные подписки" }, { status: 400 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
