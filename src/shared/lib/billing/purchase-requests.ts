import { prisma } from "@/shared/lib/db/prisma"

import { extendPremiumUntil, resolveRoleAfterPremiumPurchase } from "@/shared/lib/billing/premium"
import { type YooKassaPayment } from "@/shared/lib/billing/yookassa"

export async function approvePurchaseRequestById(params: {
  requestId: number
  reviewedByUserId?: number | null
  providerStatus?: string | null
  providerPaymentId?: string | null
}) {
  return prisma.$transaction(async (tx) => {
    const purchaseRequest = await tx.purchaseRequest.findUnique({
      where: { id: params.requestId },
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

    if (purchaseRequest.status === "APPROVED") {
      if (
        (params.providerPaymentId && purchaseRequest.providerPaymentId === params.providerPaymentId) ||
        !params.providerPaymentId
      ) {
        return { request: purchaseRequest, alreadyApproved: true as const }
      }

      return { error: "ALREADY_REVIEWED" as const }
    }

    if (purchaseRequest.status !== "PENDING") {
      return { error: "ALREADY_REVIEWED" as const }
    }

    const effectiveProviderStatus = params.providerStatus ?? purchaseRequest.providerStatus
    if (
      purchaseRequest.paymentProvider === "yookassa" &&
      effectiveProviderStatus !== "succeeded"
    ) {
      return { error: "NOT_PAID" as const }
    }

    const lockResult = await tx.purchaseRequest.updateMany({
      where: {
        id: purchaseRequest.id,
        status: "PENDING",
      },
      data: {
        status: "PROCESSING",
      },
    })

    if (lockResult.count === 0) {
      return { error: "ALREADY_REVIEWED" as const }
    }

    if (purchaseRequest.premiumMonths > 0) {
      await tx.user.update({
        where: { id: purchaseRequest.userId },
        data: {
          role: resolveRoleAfterPremiumPurchase(purchaseRequest.user.role),
          premiumUntil: extendPremiumUntil(
            purchaseRequest.user.premiumUntil,
            purchaseRequest.premiumMonths
          ),
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
        reviewedByUserId: params.reviewedByUserId ?? null,
        reviewedAt: new Date(),
        paidAt: new Date(),
        providerPaymentId: params.providerPaymentId ?? purchaseRequest.providerPaymentId,
        providerStatus: params.providerStatus ?? purchaseRequest.providerStatus,
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

    return { request: updatedRequest, alreadyApproved: false as const }
  })
}

export async function markPurchaseRequestCanceled(params: {
  requestId: number
  providerStatus?: string | null
  providerPaymentId?: string | null
}) {
  const existing = await prisma.purchaseRequest.findUnique({
    where: { id: params.requestId },
    select: {
      id: true,
      status: true,
      providerPaymentId: true,
    },
  })

  if (!existing) {
    return { error: "NOT_FOUND" as const }
  }

  if (existing.status === "APPROVED") {
    return { error: "ALREADY_APPROVED" as const }
  }

  if (existing.status !== "PENDING" && existing.status !== "PROCESSING") {
    return { request: existing }
  }

  const updatedCount = await prisma.purchaseRequest.updateMany({
    where: {
      id: existing.id,
      status: {
        in: ["PENDING", "PROCESSING"],
      },
    },
    data: {
      status: "CANCELED",
      providerStatus: params.providerStatus ?? "canceled",
      providerPaymentId: params.providerPaymentId ?? existing.providerPaymentId,
      reviewedAt: new Date(),
    },
  })

  if (updatedCount.count === 0) {
    return { error: "ALREADY_APPROVED" as const }
  }

  const updated = await prisma.purchaseRequest.findUnique({
    where: { id: existing.id },
    select: {
      id: true,
      status: true,
      providerStatus: true,
      reviewedAt: true,
    },
  })

  if (!updated) {
    return { error: "NOT_FOUND" as const }
  }

  return { request: updated }
}

export async function syncPurchaseRequestWithYooKassaPayment(params: {
  requestId: number
  payment: YooKassaPayment
}) {
  const providerStatus = params.payment.status?.trim() || null
  const providerPaymentId = params.payment.id?.trim() || null

  if (params.payment.status === "succeeded" && params.payment.paid) {
    return approvePurchaseRequestById({
      requestId: params.requestId,
      reviewedByUserId: null,
      providerStatus,
      providerPaymentId,
    })
  }

  if (params.payment.status === "canceled") {
    return markPurchaseRequestCanceled({
      requestId: params.requestId,
      providerStatus,
      providerPaymentId,
    })
  }

  const existing = await prisma.purchaseRequest.findUnique({
    where: { id: params.requestId },
    select: {
      id: true,
      status: true,
      providerPaymentId: true,
    },
  })

  if (!existing) {
    return { error: "NOT_FOUND" as const }
  }

  const updated = await prisma.purchaseRequest.update({
    where: { id: existing.id },
    data: {
      providerStatus,
      providerPaymentId: providerPaymentId ?? existing.providerPaymentId,
    },
    select: {
      id: true,
      status: true,
      providerStatus: true,
      providerPaymentId: true,
    },
  })

  return { request: updated }
}
