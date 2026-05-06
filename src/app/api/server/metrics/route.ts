import { NextResponse } from "next/server"

import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { hasAdministrativeAccess } from "@/shared/lib/auth/roles"
import { getServerMetricsSnapshot } from "@/shared/lib/server/metrics"

export async function GET() {
  const user = await getCurrentUser({ touchActivity: false })

  if (!user) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  if (!hasAdministrativeAccess(user.role)) {
    return NextResponse.json({ message: "Недостаточно прав" }, { status: 403 })
  }

  return NextResponse.json(getServerMetricsSnapshot(), { status: 200 })
}
