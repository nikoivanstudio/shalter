import { type NextRequest, NextResponse } from "next/server"

import { hasAdministrativeAccess } from "@/shared/lib/auth/roles"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"
import { deleteUploadedFileByUrl } from "@/shared/lib/media/uploads"

function parseChannelId(value: string) {
  const channelId = Number(value)
  return Number.isInteger(channelId) && channelId > 0 ? channelId : null
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ channelId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { channelId: rawChannelId } = await context.params
  const channelId = parseChannelId(rawChannelId)
  if (!channelId) {
    return NextResponse.json({ message: "Неверный id канала" }, { status: 400 })
  }

  const [requester, channel] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
    prisma.channel.findFirst({
      where: {
        id: channelId,
      },
      select: {
        id: true,
        avatarUrl: true,
        ownerId: true,
      },
    }),
  ])

  if (!channel) {
    return NextResponse.json({ message: "Канал не найден" }, { status: 404 })
  }

  if (channel.ownerId !== userId && !hasAdministrativeAccess(requester?.role)) {
    return NextResponse.json(
      { message: "Удалять канал может только владелец или администратор" },
      { status: 403 }
    )
  }

  await prisma.channel.delete({
    where: {
      id: channelId,
    },
  })
  await deleteUploadedFileByUrl(channel.avatarUrl)

  return NextResponse.json({ ok: true }, { status: 200 })
}
