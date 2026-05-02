import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

function parseContactUserId(value: string) {
  const contactUserId = Number(value)
  return Number.isInteger(contactUserId) && contactUserId > 0 ? contactUserId : null
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contactUserId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { contactUserId: rawContactUserId } = await context.params
  const contactUserId = parseContactUserId(rawContactUserId)
  if (!contactUserId) {
    return NextResponse.json({ message: "Некорректный пользователь" }, { status: 400 })
  }

  if (contactUserId === userId) {
    return NextResponse.json({ message: "Откройте свой профиль в настройках" }, { status: 400 })
  }

  const [user, blacklistEntry] = await Promise.all([
    prisma.user.findUnique({
      where: { id: contactUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        avatarTone: true,
        avatarUrl: true,
        isBlocked: true,
        starsBalance: true,
        partnerStarsEarned: true,
        createdAt: true,
        receivedGiftTransactions: {
          orderBy: { createdAt: "desc" },
          take: 12,
          select: {
            id: true,
            giftKey: true,
            giftName: true,
            starsSpent: true,
            note: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    }),
    prisma.userBlacklist.findFirst({
      where: {
        ownerId: userId,
        blockedUserId: contactUserId,
      },
      select: { id: true },
    }),
  ])

  if (!user) {
    return NextResponse.json({ message: "Пользователь не найден" }, { status: 404 })
  }

  if (blacklistEntry) {
    return NextResponse.json({ message: "Пользователь находится в чёрном списке" }, { status: 403 })
  }

  return NextResponse.json(
    {
      profile: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        gifts: user.receivedGiftTransactions.map((gift) => ({
          id: gift.id,
          giftKey: gift.giftKey,
          giftName: gift.giftName,
          starsSpent: gift.starsSpent,
          note: gift.note,
          createdAt: gift.createdAt.toISOString(),
          sender: gift.sender
            ? {
                id: gift.sender.id,
                firstName: gift.sender.firstName,
                lastName: gift.sender.lastName,
              }
            : null,
        })),
      },
    },
    { status: 200 }
  )
}
