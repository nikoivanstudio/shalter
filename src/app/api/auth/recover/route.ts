import { NextResponse } from "next/server"

import { recoverUserAccount } from "@/features/auth/api/auth-service"
import { recoveryCodeSchema } from "@/features/auth/model/schemas"
import {
  createAuthToken,
  createSessionId,
  setAuthCookies,
} from "@/shared/lib/auth/session"
import { touchUserActivity } from "@/shared/lib/user-activity"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = recoveryCodeSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Ошибка валидации",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const result = await recoverUserAccount(parsed.data)

    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: result.status })
    }

    const sessionId = createSessionId()
    const token = await createAuthToken({
      userId: result.user.id,
      email: result.user.email,
      sid: sessionId,
    })

    const response = NextResponse.json(
      {
        user: result.user,
      },
      { status: 200 }
    )
    await touchUserActivity(result.user.id, true)
    setAuthCookies(response, { token, sessionId })
    return response
  } catch (error) {
    console.error("POST /api/auth/recover failed", error)
    return NextResponse.json({ message: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
