import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/bots/[botId]">
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { botId } = await context.params
  const publicationId = Number(botId)
  if (!Number.isInteger(publicationId) || publicationId <= 0) {
    return NextResponse.json({ message: "Некорректный бот" }, { status: 400 })
  }

  const publication = await prisma.botPublication.findUnique({
    where: { id: publicationId },
    select: { id: true, ownerId: true },
  })

  if (!publication) {
    return NextResponse.json({ message: "Публикация не найдена" }, { status: 404 })
  }

  if (publication.ownerId !== userId) {
    return NextResponse.json({ message: "Можно удалять только свои публикации" }, { status: 403 })
  }

  await prisma.botPublication.delete({
    where: { id: publicationId },
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
