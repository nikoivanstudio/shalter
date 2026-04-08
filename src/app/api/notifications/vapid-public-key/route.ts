import { NextResponse } from "next/server"

import { getPublicVapidKey } from "@/shared/lib/notifications/push"

export async function GET() {
  const publicKey = getPublicVapidKey()
  if (!publicKey) {
    return NextResponse.json(
      { message: "Push уведомления не настроены на сервере" },
      { status: 503 }
    )
  }

  return NextResponse.json({ publicKey }, { status: 200 })
}
