import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { canAssignManagedRole } from "@/shared/lib/auth/roles"
import { approvePurchaseRequestById } from "@/shared/lib/billing/purchase-requests"
import { prisma } from "@/shared/lib/db/prisma"

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

  const result = await approvePurchaseRequestById({
    requestId: parsedRequestId,
    reviewedByUserId: actor.id,
  })

  if ("error" in result) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ message: "Заявка не найдена" }, { status: 404 })
    }

    if (result.error === "NOT_PAID") {
      return NextResponse.json(
        { message: "Платёж ещё не подтверждён ЮKassa" },
        { status: 409 }
      )
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
