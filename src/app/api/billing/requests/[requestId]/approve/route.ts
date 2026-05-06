import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { canAssignManagedRole } from "@/shared/lib/auth/roles"
import { prisma } from "@/shared/lib/db/prisma"
import { extendPremiumUntil, resolveRoleAfterPremiumPurchase } from "@/shared/lib/billing/premium"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> }
) {
  const actorId = await getAuthorizedUserIdFromRequest(request)
  if (!actorId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, role: true },
  })

  if (!actor || !canAssignManagedRole(actor.role)) {
    return NextResponse.json({ message: "Недостаточно прав" }, { status: 403 })
  }

  const { requestId } = await context.params
  const parsedRequestId = Number(requestId)
  if (!Number.isInteger(parsedRequestId) || parsedRequestId <= 0) {
    return NextResponse.json({ message: "Некорректная заявка" }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const purchaseRequest = await tx.purchaseRequest.findUnique({
      where: { id: parsedRequestId },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            premiumUntil: true,
            starsBalance: true,
          },
        },
      },
    })

    if (!purchaseRequest) {
      return { error: "NOT_FOUND" as const }
    }

    if (purchaseRequest.status !== "PENDING") {
      return { error: "ALREADY_REVIEWED" as const }
    }

    if (purchaseRequest.premiumMonths > 0) {
      await tx.user.update({
        where: { id: purchaseRequest.userId },
        data: {
          role: resolveRoleAfterPremiumPurchase(purchaseRequest.user.role),
          premiumUntil: extendPremiumUntil(purchaseRequest.user.premiumUntil, purchaseRequest.premiumMonths),
          updatedAt: new Date(),
        },
      })
    }

    if (purchaseRequest.starsAmount > 0) {
      await tx.user.update({
        where: { id: purchaseRequest.userId },
        data: {
          starsBalance: {
            increment: purchaseRequest.starsAmount,
          },
          updatedAt: new Date(),
        },
      })

      await tx.starTransaction.create({
        data: {
          senderId: null,
          recipientId: purchaseRequest.userId,
          amount: purchaseRequest.starsAmount,
          kind: "PURCHASE_STARS",
          note: `Approved purchase ${purchaseRequest.productKey}`,
        },
      })
    }

    const updatedRequest = await tx.purchaseRequest.update({
      where: { id: purchaseRequest.id },
      data: {
        status: "APPROVED",
        reviewedByUserId: actor.id,
        reviewedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return { request: updatedRequest }
  })

  if ("error" in result) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ message: "Заявка не найдена" }, { status: 404 })
    }

    return NextResponse.json({ message: "Заявка уже обработана" }, { status: 409 })
  }

  return NextResponse.json(
    {
      request: {
        ...result.request,
        createdAt: result.request.createdAt.toISOString(),
        reviewedAt: result.request.reviewedAt?.toISOString() ?? null,
      },
    },
    { status: 200 }
  )
}
