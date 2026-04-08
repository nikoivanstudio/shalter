import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

export async function GET(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const unread = await prisma.message.groupBy({
    by: ["dialogId"],
    where: {
      authorId: { not: userId },
      status: { not: "READ" },
      dialog: {
        users: {
          some: { id: userId },
        },
      },
    },
    _count: {
      _all: true,
    },
  })

  const unreadByDialog = Object.fromEntries(
    unread.map((item) => [String(item.dialogId), item._count._all])
  )

  return NextResponse.json(
    {
      unreadByDialog,
      dialogsWithUnread: unread.length,
    },
    { status: 200 }
  )
}
