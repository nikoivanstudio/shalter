import { NextResponse } from "next/server"

import { requestRecoveryCode } from "@/features/auth/api/auth-service"
import { recoveryPhoneSchema } from "@/features/auth/model/schemas"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = recoveryPhoneSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Ошибка валидации",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    await requestRecoveryCode(parsed.data)

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("POST /api/auth/recover/request-code failed", error)
    return NextResponse.json({ message: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
