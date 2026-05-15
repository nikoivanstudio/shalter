import { NextResponse } from "next/server"

import { requestRecoveryCode } from "@/features/auth/api/auth-service"
import { recoveryPhoneSchema } from "@/features/auth/model/schemas"
import { getMailConfigurationError, isMailConfigured } from "@/shared/lib/mail"

export async function POST(request: Request) {
  try {
    if (!isMailConfigured()) {
      return NextResponse.json(
        { message: getMailConfigurationError() ?? "Отправка email не настроена" },
        { status: 503 }
      )
    }

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

    const result = await requestRecoveryCode(parsed.data)
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: result.status })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("POST /api/auth/recover/request-code failed", error)
    return NextResponse.json({ message: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
