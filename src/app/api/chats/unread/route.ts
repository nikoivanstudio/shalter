import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"
import { isUserOnline } from "@/shared/lib/user-activity"

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

  const dialogs = await prisma.dialog.findMany({
    where: {
      users: {
        some: { id: userId },
      },
    },
    select: {
      users: {
        select: {
          id: true,
          lastSeenAt: true,
        },
      },
    },
  })

  return NextResponse.json(
    {
      unreadByDialog,
      dialogsWithUnread: unread.length,
      presenceByUserId: Object.fromEntries(
        dialogs
          .flatMap((dialog) => dialog.users)
          .map((dialogUser) => [
            String(dialogUser.id),
            {
              lastSeenAt: dialogUser.lastSeenAt ? dialogUser.lastSeenAt.toISOString() : null,
              isOnline: isUserOnline(dialogUser.lastSeenAt),
            },
          ])
      ),
    },
    { status: 200 }
  )
}
