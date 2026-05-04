import { type NextRequest, NextResponse } from "next/server"

import { hasAdministrativeAccess } from "@/shared/lib/auth/roles"
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

  const [requester, user, blacklistEntry, isViewerInContacts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
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
        profileVisibility: true,
        showEmailInProfile: true,
        showPhoneInProfile: true,
        showGiftsInProfile: true,
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
    prisma.contact.findFirst({
      where: {
        ownerId: contactUserId,
        contactUserId: userId,
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

  const isPrivilegedViewer = hasAdministrativeAccess(requester?.role)
  const canViewByPrivacy =
    isPrivilegedViewer || user.profileVisibility === "everyone" || Boolean(isViewerInContacts)

  if (!canViewByPrivacy) {
    return NextResponse.json({ message: "Профиль доступен только контактам" }, { status: 403 })
  }

  const canSeeEmail = isPrivilegedViewer || user.showEmailInProfile
  const canSeePhone = isPrivilegedViewer || user.showPhoneInProfile
  const canSeeGifts = isPrivilegedViewer || user.showGiftsInProfile

  return NextResponse.json(
    {
      profile: {
        id: user.id,
        email: canSeeEmail ? user.email : null,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: canSeePhone ? user.phone : null,
        role: user.role,
        avatarTone: user.avatarTone,
        avatarUrl: user.avatarUrl,
        isBlocked: user.isBlocked,
        starsBalance: user.starsBalance,
        partnerStarsEarned: user.partnerStarsEarned,
        createdAt: user.createdAt.toISOString(),
        giftsVisible: canSeeGifts,
        gifts: (canSeeGifts ? user.receivedGiftTransactions : []).map((gift) => ({
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
