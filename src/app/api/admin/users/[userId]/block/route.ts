import { z } from "zod"
import { type NextRequest, NextResponse } from "next/server"

import { canAssignManagedRole } from "@/shared/lib/auth/roles"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

const updateUserBlockSchema = z.object({
  isBlocked: z.boolean(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const authorizedUserId = await getAuthorizedUserIdFromRequest(request)
  if (!authorizedUserId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: authorizedUserId },
    select: { id: true, role: true },
  })

  if (!currentUser || !canAssignManagedRole(currentUser.role)) {
    return NextResponse.json({ message: "Недостаточно прав" }, { status: 403 })
  }

  const { userId } = await context.params
  const targetUserId = Number(userId)
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return NextResponse.json({ message: "Некорректный пользователь" }, { status: 400 })
  }

  if (targetUserId === currentUser.id) {
    return NextResponse.json({ message: "Нельзя изменить собственную роль" }, { status: 400 })
  }

  const json = await request.json().catch(() => null)
  const parsed = updateUserBlockSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ message: "Ошибка валидации" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  })

  if (!user) {
    return NextResponse.json({ message: "Пользователь не найден" }, { status: 404 })
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      isBlocked: parsed.data.isBlocked,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isBlocked: true,
    },
  })

  return NextResponse.json({ user: updatedUser }, { status: 200 })
}
