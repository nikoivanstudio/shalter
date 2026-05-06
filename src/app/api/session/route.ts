import { NextResponse } from "next/server"

import { getCurrentUser } from "@/shared/lib/auth/current-user"

export async function GET() {
  const user = await getCurrentUser({ touchActivity: false })
  if (!user) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  return NextResponse.json(
    {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatarTone: user.avatarTone,
        avatarUrl: user.avatarUrl,
      },
    },
    { status: 200 }
  )
}
