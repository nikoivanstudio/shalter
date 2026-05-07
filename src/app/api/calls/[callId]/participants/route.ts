import { type NextRequest, NextResponse } from "next/server"

import { inviteUsersToCall, getCallRecord } from "@/features/calls/lib/call-store"
import { updateDialogParticipantsSchema } from "@/features/chats/model/schemas"
import { findUsersWhoBlockedActor, formatBlacklistUserName } from "@/shared/lib/blacklist"
import { prisma } from "@/shared/lib/db/prisma"

import { getAuthorizedCallContext } from "../../_lib"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ callId: string }> }
) {
  const auth = await getAuthorizedCallContext(request)
  if ("error" in auth) {
    return auth.error
  }

  const { callId } = await context.params
  const call = getCallRecord(callId)
  if (!call) {
    return NextResponse.json({ message: "Звонок не найден" }, { status: 404 })
  }

  if (!call.participantsById.has(auth.userId)) {
    return NextResponse.json(
      { message: "Приглашать участников в звонок может только подключённый участник" },
      { status: 403 }
    )
  }

  const json = await request.json().catch(() => null)
  const parsed = updateDialogParticipantsSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Ошибка валидации",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const existingUserIds = new Set(call.usersById.keys())
  const participantIds = Array.from(
    new Set(
      parsed.data.participantIds.filter(
        (userId) => userId !== auth.userId && !existingUserIds.has(userId)
      )
    )
  )

  if (participantIds.length === 0) {
    return NextResponse.json(
      { message: "Выберите хотя бы одного нового участника для звонка" },
      { status: 400 }
    )
  }

  const allowedContacts = await prisma.contact.findMany({
    where: {
      ownerId: auth.userId,
      contactUserId: { in: participantIds },
    },
    select: { contactUserId: true },
  })

  if (allowedContacts.length !== participantIds.length) {
    return NextResponse.json(
      { message: "В звонок можно приглашать только пользователей из ваших контактов" },
      { status: 400 }
    )
  }

  const blockedByUsers = await findUsersWhoBlockedActor(auth.userId, participantIds)
  if (blockedByUsers.length > 0) {
    const names = blockedByUsers.map((item) => formatBlacklistUserName(item.owner)).join(", ")
    return NextResponse.json(
      {
        message: `Нельзя пригласить в звонок: ${names}. Этот пользователь добавил вас в чёрный список`,
      },
      { status: 403 }
    )
  }

  const users = await prisma.user.findMany({
    where: { id: { in: participantIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarTone: true,
      avatarUrl: true,
    },
    orderBy: { id: "asc" },
  })

  if (users.length !== participantIds.length) {
    return NextResponse.json({ message: "Не все пользователи найдены" }, { status: 404 })
  }

  const snapshot = inviteUsersToCall(
    callId,
    users.map((user) => ({
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatarTone: user.avatarTone,
      avatarUrl: user.avatarUrl,
    }))
  )

  if (!snapshot) {
    return NextResponse.json({ message: "Не удалось обновить звонок" }, { status: 400 })
  }

  return NextResponse.json({ call: snapshot }, { status: 200 })
}
