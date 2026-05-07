import { type NextRequest, NextResponse } from "next/server"

import { getAppUrlFromRequest } from "@/shared/lib/app-url"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { getBillingProduct } from "@/shared/lib/billing/catalog"
import {
  createYooKassaPayment,
  getYooKassaConfigurationError,
  isYooKassaConfigured,
} from "@/shared/lib/billing/yookassa"
import { prisma } from "@/shared/lib/db/prisma"

export async function POST(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const productKey = typeof body?.productKey === "string" ? body.productKey.trim() : ""
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 255) : null
  const product = getBillingProduct(productKey)

  if (!product) {
    return NextResponse.json({ message: "Неизвестный продукт оплаты" }, { status: 400 })
  }

  if (product.requiresCheckout && !isYooKassaConfigured()) {
    return NextResponse.json(
      {
        message:
          getYooKassaConfigurationError() ??
          "Для этого товара ещё не настроена безопасная оплата через провайдера.",
      },
      { status: 503 }
    )
  }

  const purchaseRequest = await prisma.purchaseRequest.create({
    data: {
      userId,
      productKey: product.key,
      amountRub: product.amountRub,
      premiumMonths: product.premiumMonths,
      starsAmount: product.starsAmount,
      status: "PENDING",
      note,
      paymentProvider: "yookassa",
      providerStatus: "pending",
    },
    select: {
      id: true,
      productKey: true,
      amountRub: true,
      premiumMonths: true,
      starsAmount: true,
      status: true,
      note: true,
      checkoutUrl: true,
      paymentProvider: true,
      providerPaymentId: true,
      providerStatus: true,
      createdAt: true,
    },
  })

  try {
    const appUrl = getAppUrlFromRequest(request)
    const payment = await createYooKassaPayment({
      amountRub: product.amountRub,
      description: `${product.title} - user ${userId} - request ${purchaseRequest.id}`,
      returnUrl: `${appUrl}/billing/return?requestId=${purchaseRequest.id}`,
      metadata: {
        purchase_request_id: String(purchaseRequest.id),
        product_key: product.key,
        user_id: String(userId),
      },
    })

    const updatedRequest = await prisma.purchaseRequest.update({
      where: { id: purchaseRequest.id },
      data: {
        providerPaymentId: payment.id,
        providerStatus: payment.status,
        checkoutUrl: payment.confirmationUrl,
      },
      select: {
        id: true,
        productKey: true,
        amountRub: true,
        premiumMonths: true,
        starsAmount: true,
        status: true,
        note: true,
        checkoutUrl: true,
        paymentProvider: true,
        providerPaymentId: true,
        providerStatus: true,
        createdAt: true,
      },
    })

    return NextResponse.json(
      {
        request: {
          ...updatedRequest,
          createdAt: updatedRequest.createdAt.toISOString(),
        },
        checkoutUrl: payment.confirmationUrl,
        mode: "checkout",
        provider: "yookassa",
      },
      { status: 201 }
    )
  } catch (error) {
    await prisma.purchaseRequest.delete({
      where: { id: purchaseRequest.id },
    })

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Не удалось открыть безопасную оплату через ЮKassa",
      },
      { status: 502 }
    )
  }
}
