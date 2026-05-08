import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    {
      message: "Отправка кода восстановления больше не поддерживается",
    },
    { status: 410 }
  )
}
