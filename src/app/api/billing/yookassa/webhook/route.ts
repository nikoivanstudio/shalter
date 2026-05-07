import { NextResponse } from "next/server"

import { syncPurchaseRequestWithYooKassaPayment } from "@/shared/lib/billing/purchase-requests"
import { getYooKassaPayment } from "@/shared/lib/billing/yookassa"

type YooKassaWebhookPayload = {
  type?: string
  event?: string
  object?: {
    id?: string
    metadata?: Record<string, string | undefined>
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as YooKassaWebhookPayload | null
  const paymentId = payload?.object?.id?.trim() ?? ""
  const requestIdValue = payload?.object?.metadata?.purchase_request_id?.trim() ?? ""
  const requestId = Number(requestIdValue)

  if (!paymentId || !Number.isInteger(requestId) || requestId <= 0) {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  try {
    const payment = await getYooKassaPayment(paymentId)
    const verifiedRequestId = Number(payment.metadata?.purchase_request_id ?? "")
    if (!Number.isInteger(verifiedRequestId) || verifiedRequestId !== requestId) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    await syncPurchaseRequestWithYooKassaPayment({
      requestId: verifiedRequestId,
      payment,
    })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
