import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { getBillingCheckoutUrl, getBillingProduct } from "@/shared/lib/billing/catalog"
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

  const checkoutUrl = getBillingCheckoutUrl(product.key)

  const purchaseRequest = await prisma.purchaseRequest.create({
    data: {
      userId,
      productKey: product.key,
      amountRub: product.amountRub,
      premiumMonths: product.premiumMonths,
      starsAmount: product.starsAmount,
      status: "PENDING",
      note,
      checkoutUrl,
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
      createdAt: true,
    },
  })

  return NextResponse.json(
    {
      request: {
        ...purchaseRequest,
        createdAt: purchaseRequest.createdAt.toISOString(),
      },
      checkoutUrl,
      mode: checkoutUrl ? "checkout" : "manual-review",
    },
    { status: 201 }
  )
}
