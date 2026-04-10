import { NextResponse } from "next/server"

import { loginUser } from "@/features/auth/api/auth-service"
import { loginSchema } from "@/features/auth/model/schemas"
import {
  createAuthToken,
  createSessionId,
  setAuthCookies,
} from "@/shared/lib/auth/session"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = loginSchema.safeParse(json)

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      return NextResponse.json(
        {
          message: "Ошибка валидации",
          fieldErrors,
        },
        { status: 400 }
      )
    }

    const result = await loginUser(parsed.data)

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
    setAuthCookies(response, { token, sessionId })
    return response
  } catch (error) {
    console.error("POST /api/auth/login failed", error)
    return NextResponse.json({ message: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
