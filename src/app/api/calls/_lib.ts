import { NextResponse, type NextRequest } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

export async function getAuthorizedCallContext(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return {
      error: NextResponse.json({ message: "Не авторизован" }, { status: 401 }),
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarTone: true,
      avatarUrl: true,
    },
  })

  if (!user) {
    return {
      error: NextResponse.json({ message: "Пользователь не найден" }, { status: 404 }),
    }
  }

  return {
    userId,
    user: {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatarTone: user.avatarTone,
      avatarUrl: user.avatarUrl,
    },
  }
}

export async function getDialogUsersForCalls(dialogId: number) {
  return prisma.dialog.findUnique({
    where: { id: dialogId },
    select: {
      id: true,
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarTone: true,
          avatarUrl: true,
        },
      },
    },
  })
}
