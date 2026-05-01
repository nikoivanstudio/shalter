import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"
import { getGiftByKey, hasInfiniteStars } from "@/shared/lib/rewards/catalog"

export async function POST(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const recipientEmail =
    typeof body?.recipientEmail === "string" ? body.recipientEmail.trim().toLowerCase() : ""
  const giftKey = typeof body?.giftKey === "string" ? body.giftKey.trim() : ""
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 255) : null

  const gift = getGiftByKey(giftKey)
  if (!recipientEmail || !gift) {
    return NextResponse.json({ message: "Некорректные данные подарка" }, { status: 400 })
  }

  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      starsBalance: true,
    },
  })

  if (!actor) {
    return NextResponse.json({ message: "Пользователь не найден" }, { status: 404 })
  }

  const recipient = await prisma.user.findUnique({
    where: { email: recipientEmail },
    select: {
      id: true,
      email: true,
      firstName: true,
      isBlocked: true,
    },
  })

  if (!recipient || recipient.isBlocked) {
    return NextResponse.json({ message: "Получатель не найден" }, { status: 404 })
  }

  if (recipient.id === actor.id) {
    return NextResponse.json({ message: "Нельзя отправить подарок самому себе" }, { status: 400 })
  }

  const isAdmin = hasInfiniteStars(actor.role)
  if (!isAdmin && actor.starsBalance < gift.cost) {
    return NextResponse.json({ message: "Недостаточно звёзд для покупки подарка" }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    if (!isAdmin) {
      await tx.user.update({
        where: { id: actor.id },
        data: {
          starsBalance: {
            decrement: gift.cost,
          },
          updatedAt: new Date(),
        },
      })
    }

    await tx.giftTransaction.create({
      data: {
        senderId: actor.id,
        recipientId: recipient.id,
        giftKey: gift.key,
        giftName: gift.name,
        starsSpent: gift.cost,
        note,
      },
    })
  })

  return NextResponse.json(
    {
      ok: true,
      gift: {
        key: gift.key,
        name: gift.name,
        cost: gift.cost,
      },
      sender: {
        id: actor.id,
        starsBalance: isAdmin ? actor.starsBalance : actor.starsBalance - gift.cost,
        infiniteStars: isAdmin,
      },
      recipient: {
        id: recipient.id,
        email: recipient.email,
        firstName: recipient.firstName,
      },
    },
    { status: 200 }
  )
}
