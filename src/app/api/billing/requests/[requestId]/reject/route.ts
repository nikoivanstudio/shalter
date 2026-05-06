import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { canAssignManagedRole } from "@/shared/lib/auth/roles"
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

  const existing = await prisma.purchaseRequest.findUnique({
    where: { id: parsedRequestId },
    select: { id: true, status: true },
  })

  if (!existing) {
    return NextResponse.json({ message: "Заявка не найдена" }, { status: 404 })
  }

  if (existing.status !== "PENDING") {
    return NextResponse.json({ message: "Заявка уже обработана" }, { status: 409 })
  }

  const updated = await prisma.purchaseRequest.update({
    where: { id: existing.id },
    data: {
      status: "REJECTED",
      reviewedByUserId: actor.id,
      reviewedAt: new Date(),
    },
    select: {
      id: true,
      status: true,
      reviewedAt: true,
    },
  })

  return NextResponse.json(
    {
      request: {
        ...updated,
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      },
    },
    { status: 200 }
  )
}
