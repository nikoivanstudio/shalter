export type BillingProductKey =
  | "premium-month"
  | "premium-year"
  | "stars-100"
  | "stars-1000"
  | "stars-10000"

export type BillingProduct = {
  key: BillingProductKey
  title: string
  description: string
  amountRub: number
  premiumMonths: number
  starsAmount: number
}

export const billingProducts: BillingProduct[] = [
  {
    key: "premium-month",
    title: "Premium на месяц",
    description: "Доступ premium на 1 месяц.",
    amountRub: 5,
    premiumMonths: 1,
    starsAmount: 0,
  },
  {
    key: "premium-year",
    title: "Premium на год",
    description: "Доступ premium на 12 месяцев.",
    amountRub: 20,
    premiumMonths: 12,
    starsAmount: 0,
  },
  {
    key: "stars-100",
    title: "100 звёзд",
    description: "Пакет для подарков и переводов.",
    amountRub: 1,
    premiumMonths: 0,
    starsAmount: 100,
  },
  {
    key: "stars-1000",
    title: "1000 звёзд",
    description: "Расширенный пакет звёзд.",
    amountRub: 10,
    premiumMonths: 0,
    starsAmount: 1000,
  },
  {
    key: "stars-10000",
    title: "10000 звёзд",
    description: "Большой пакет звёзд.",
    amountRub: 100,
    premiumMonths: 0,
    starsAmount: 10000,
  },
] as const

export function getBillingProduct(key: string) {
  return billingProducts.find((item) => item.key === key) ?? null
}

export function getBillingCheckoutUrl(productKey: BillingProductKey) {
  const envMap: Record<BillingProductKey, string | undefined> = {
    "premium-month": process.env.PREMIUM_MONTH_PAYMENT_URL,
    "premium-year": process.env.PREMIUM_YEAR_PAYMENT_URL,
    "stars-100": process.env.STARS_100_PAYMENT_URL,
    "stars-1000": process.env.STARS_1000_PAYMENT_URL,
    "stars-10000": process.env.STARS_10000_PAYMENT_URL,
  }

  const url = envMap[productKey]?.trim()
  return url ? url : null
}
