import { hasAdministrativeAccess } from "@/shared/lib/auth/roles"

export const PARTNER_REWARD_STARS = 25

export const giftCatalog = [
  {
    key: "coffee",
    name: "Кофе-бонус",
    cost: 15,
    description: "Небольшой знак внимания и поддержки.",
  },
  {
    key: "boost",
    name: "Буст проекта",
    cost: 40,
    description: "Подарок для мотивации и роста.",
  },
  {
    key: "launch-box",
    name: "Launch box",
    cost: 75,
    description: "Подарок для успешного запуска и новых идей.",
  },
  {
    key: "gold-star",
    name: "Золотая звезда",
    cost: 120,
    description: "Премиальный подарок за сильный вклад.",
  },
] as const

export type GiftKey = (typeof giftCatalog)[number]["key"]

export function getGiftByKey(key: string) {
  return giftCatalog.find((gift) => gift.key === key) ?? null
}

export function hasInfiniteStars(role?: string | null) {
  return hasAdministrativeAccess(role)
}
