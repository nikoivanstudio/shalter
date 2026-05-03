import { type NextRequest, NextResponse } from "next/server"

import { createCall, type CallMediaMode } from "@/features/calls/lib/call-store"

import { getAuthorizedCallContext, getDialogUsersForCalls } from "./_lib"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const auth = await getAuthorizedCallContext(request)
  if ("error" in auth) {
    return auth.error
  }

  const body = (await request.json().catch(() => null)) as
    | { dialogId?: number; media?: CallMediaMode }
    | null

  const dialogId =
    typeof body?.dialogId === "number" && Number.isInteger(body.dialogId) && body.dialogId > 0
      ? body.dialogId
      : null
  const media = body?.media === "video" ? "video" : body?.media === "audio" ? "audio" : null

  if (!dialogId || !media) {
    return NextResponse.json({ message: "Некорректные параметры звонка" }, { status: 400 })
  }

  const dialog = await getDialogUsersForCalls(dialogId)
  if (!dialog || !dialog.users.some((user) => user.id === auth.userId)) {
    return NextResponse.json({ message: "Чат не найден" }, { status: 404 })
  }

  const call = createCall({
    dialogId,
    media,
    createdBy: auth.user,
    users: dialog.users.map((user) => ({
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatarTone: user.avatarTone,
      avatarUrl: user.avatarUrl,
    })),
  })

  return NextResponse.json({ call }, { status: 201 })
}
