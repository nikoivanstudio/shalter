import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { normalizeRole } from "@/shared/lib/auth/roles"
import { prisma } from "@/shared/lib/db/prisma"
import { hasInfiniteStars } from "@/shared/lib/rewards/catalog"

function parseAmount(value: unknown) {
  const amount = Number(value)
  return Number.isInteger(amount) && amount > 0 ? amount : null
}

export async function POST(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const recipientEmail =
    typeof body?.recipientEmail === "string" ? body.recipientEmail.trim().toLowerCase() : ""
  const amount = parseAmount(body?.amount)
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 255) : null

  if (!recipientEmail || !amount) {
    return NextResponse.json({ message: "Некорректные данные перевода" }, { status: 400 })
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

  if (!hasInfiniteStars(actor.role)) {
    return NextResponse.json(
      { message: "Дарить звёзды другим может только администратор" },
      { status: 403 }
    )
  }

  const recipient = await prisma.user.findUnique({
    where: { email: recipientEmail },
    select: {
      id: true,
      email: true,
      firstName: true,
      isBlocked: true,
      starsBalance: true,
    },
  })

  if (!recipient || recipient.isBlocked) {
    return NextResponse.json({ message: "Получатель не найден" }, { status: 404 })
  }

  if (recipient.id === actor.id) {
    return NextResponse.json({ message: "Нельзя дарить звёзды самому себе" }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: recipient.id },
      data: {
        starsBalance: {
          increment: amount,
        },
        updatedAt: new Date(),
      },
    })

    await tx.starTransaction.create({
      data: {
        senderId: actor.id,
        recipientId: recipient.id,
        amount,
        kind: "ADMIN_GIFT_STARS",
        note,
      },
    })
  })

  return NextResponse.json(
    {
      ok: true,
      sender: {
        id: actor.id,
        role: normalizeRole(actor.role),
        infiniteStars: true,
      },
      recipient: {
        id: recipient.id,
        email: recipient.email,
        firstName: recipient.firstName,
        starsBalance: recipient.starsBalance + amount,
      },
    },
    { status: 200 }
  )
}
