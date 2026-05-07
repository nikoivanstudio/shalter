import Link from "next/link"
import { redirect } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Providers } from "@/app/providers"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import { getBillingProduct } from "@/shared/lib/billing/catalog"
import { syncPurchaseRequestWithYooKassaPayment } from "@/shared/lib/billing/purchase-requests"
import { getYooKassaPayment } from "@/shared/lib/billing/yookassa"
import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { prisma } from "@/shared/lib/db/prisma"
import { cn } from "@/lib/utils"

function getStatusCopy(status: string) {
  if (status === "APPROVED") {
    return {
      title: "Оплата подтверждена",
      description: "Покупка успешно зачислена в аккаунт.",
    }
  }

  if (status === "CANCELED") {
    return {
      title: "Оплата отменена",
      description: "Платёж не был завершён. Вы можете вернуться и попробовать ещё раз.",
    }
  }

  return {
    title: "Платёж обрабатывается",
    description:
      "ЮKassa уже вернула вас в приложение, но подтверждение оплаты ещё не дошло. Статус обновится после ответа провайдера.",
  }
}

export default async function BillingReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/auth")
  }

  const params = await searchParams
  const requestId = Number(params.requestId)

  if (!Number.isInteger(requestId) || requestId <= 0) {
    redirect("/")
  }

  const purchaseRequest = await prisma.purchaseRequest.findFirst({
    where: {
      id: requestId,
      userId: user.id,
    },
    select: {
      id: true,
      productKey: true,
      amountRub: true,
      status: true,
      providerPaymentId: true,
      providerStatus: true,
      createdAt: true,
      reviewedAt: true,
    },
  })

  if (!purchaseRequest) {
    redirect("/")
  }

  if (purchaseRequest.providerPaymentId) {
    try {
      const payment = await getYooKassaPayment(purchaseRequest.providerPaymentId)
      await syncPurchaseRequestWithYooKassaPayment({
        requestId: purchaseRequest.id,
        payment,
      })
    } catch {
      // Keep the page usable even if sync fails temporarily.
    }
  }

  const freshRequest = await prisma.purchaseRequest.findUnique({
    where: { id: purchaseRequest.id },
    select: {
      id: true,
      status: true,
      amountRub: true,
      productKey: true,
      createdAt: true,
      reviewedAt: true,
    },
  })

  if (!freshRequest) {
    redirect("/")
  }

  const copy = getStatusCopy(freshRequest.status)
  const productTitle = getBillingProduct(freshRequest.productKey)?.title ?? freshRequest.productKey

  return (
    <Providers>
      <PwaRegisterClient />
      <main className="min-h-screen px-4 py-6">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>{copy.title}</CardTitle>
              <CardDescription>{copy.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="font-medium">{productTitle}</p>
                <p className="text-muted-foreground">{freshRequest.amountRub} ₽</p>
                <p className="text-muted-foreground">
                  Создано: {new Date(freshRequest.createdAt).toLocaleString("ru-RU")}
                </p>
                {freshRequest.reviewedAt ? (
                  <p className="text-muted-foreground">
                    Обновлено: {new Date(freshRequest.reviewedAt).toLocaleString("ru-RU")}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href="/" className={cn(buttonVariants({ variant: "default" }))}>
                  Вернуться в профиль
                </Link>
                {freshRequest.status !== "APPROVED" ? (
                  <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
                    Открыть покупки
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </Providers>
  )
}
