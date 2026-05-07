import { NextResponse, type NextRequest } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { getIceServers } from "@/shared/lib/calls/ice-servers"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  return NextResponse.json(
    {
      iceServers: getIceServers(),
    },
    { status: 200 }
  )
}
