const YOOKASSA_API_URL = "https://api.yookassa.ru/v3"

export type YooKassaPayment = {
  id: string
  status: string
  paid: boolean
  metadata?: Record<string, string | undefined>
  confirmation?: {
    type?: string
    confirmation_url?: string
  }
}

function getFirstDefinedEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) {
      return value
    }
  }

  return null
}

function getYooKassaConfig() {
  const shopId = getFirstDefinedEnv("YOOKASSA_SHOP_ID", "YUKASSA_SHOP_ID")
  const secretKey = getFirstDefinedEnv("YOOKASSA_SECRET_KEY", "YUKASSA_SECRET_KEY")
  const missing: string[] = []

  if (!shopId) {
    missing.push("YOOKASSA_SHOP_ID")
  }

  if (!secretKey) {
    missing.push("YOOKASSA_SECRET_KEY")
  }

  return {
    shopId,
    secretKey,
    missing,
  }
}

export function isYooKassaConfigured() {
  return getYooKassaConfig().missing.length === 0
}

export function getYooKassaConfigurationError() {
  const config = getYooKassaConfig()
  if (config.missing.length === 0) {
    return null
  }

  return `ЮKassa не настроена: отсутствует ${config.missing.join(", ")}`
}

async function yookassaFetch<T>(path: string, init?: RequestInit) {
  const config = getYooKassaConfig()
  if (config.missing.length > 0 || !config.shopId || !config.secretKey) {
    throw new Error(getYooKassaConfigurationError() ?? "ЮKassa не настроена")
  }

  const auth = Buffer.from(`${config.shopId}:${config.secretKey}`).toString("base64")
  const response = await fetch(`${YOOKASSA_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  })

  const data = (await response.json().catch(() => null)) as
    | (T & { description?: string })
    | { description?: string }
    | null

  if (!response.ok) {
    throw new Error(data?.description ?? "ЮKassa вернула ошибку")
  }

  return data as T
}

export async function createYooKassaPayment(params: {
  amountRub: number
  description: string
  returnUrl: string
  metadata?: Record<string, string>
}) {
  const amountValue = params.amountRub.toFixed(2)
  const payment = await yookassaFetch<YooKassaPayment>("/payments", {
    method: "POST",
    headers: {
      "Idempotence-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      amount: {
        value: amountValue,
        currency: "RUB",
      },
      capture: true,
      save_payment_method: false,
      confirmation: {
        type: "redirect",
        return_url: params.returnUrl,
      },
      description: params.description.slice(0, 128),
      metadata: params.metadata ?? {},
    }),
  })

  const confirmationUrl = payment.confirmation?.confirmation_url?.trim() ?? ""
  if (!confirmationUrl) {
    throw new Error("ЮKassa не вернула ссылку на страницу оплаты")
  }

  return {
    ...payment,
    confirmationUrl,
  }
}

export async function getYooKassaPayment(paymentId: string) {
  if (!paymentId.trim()) {
    throw new Error("Не передан идентификатор платежа ЮKassa")
  }

  return yookassaFetch<YooKassaPayment>(`/payments/${paymentId}`)
}
