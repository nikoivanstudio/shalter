import { hasAdministrativeAccess } from "@/shared/lib/auth/roles"

export const PARTNER_REWARD_STARS = 10
export const PARTNER_REWARD_PREMIUM_DAYS = 5

export const giftCatalog = [
  {
    key: "bitcoin-vault",
    name: "Bitcoin Vault",
    cost: 210,
    description: "Crypto gift paid with stars for rare moments, bold support, and digital flex.",
    imageUrl: "/gifts/bitcoin-vault.svg",
  },
  {
    key: "ethereum-orbit",
    name: "Ethereum Orbit",
    cost: 160,
    description: "A smart crypto reward for architecture, product thinking, and deep technical work.",
    imageUrl: "/gifts/ethereum-orbit.svg",
  },
  {
    key: "ton-comet",
    name: "TON Comet",
    cost: 95,
    description: "Fast and light crypto-themed reward for launches, chats, and quick wins.",
    imageUrl: "/gifts/ton-comet.svg",
  },
  {
    key: "sad-token",
    name: "SAD Token",
    cost: 140,
    description: "House crypto for stars with a live market vibe, chart swings, and a moody premium aura.",
    imageUrl: "/gifts/sad-token.svg",
  },
  {
    key: "coffee",
    name: "Кофе-бонус",
    cost: 15,
    description: "Небольшой знак внимания и поддержки.",
    imageUrl: "/gifts/coffee-bonus.svg",
  },
  {
    key: "boost",
    name: "Буст проекта",
    cost: 40,
    description: "Подарок для мотивации, фокуса и движения вперёд.",
    imageUrl: "/gifts/project-boost.svg",
  },
  {
    key: "launch-box",
    name: "Launch box",
    cost: 75,
    description: "Набор для смелого запуска, новой идеи и первого рывка.",
    imageUrl: "/gifts/launch-box.svg",
  },
  {
    key: "gold-star",
    name: "Золотая звезда",
    cost: 120,
    description: "Премиальный подарок за сильный вклад и заметный результат.",
    imageUrl: "/gifts/gold-star.svg",
  },
  {
    key: "flower-wave",
    name: "Цветочная волна",
    cost: 25,
    description: "Тёплый подарок с лёгким вау-эффектом для хорошего дня.",
    imageUrl: "/gifts/flower-wave.svg",
  },
  {
    key: "neon-heart",
    name: "Неоновое сердце",
    cost: 55,
    description: "Для благодарности, симпатии и яркого эмоционального отклика.",
    imageUrl: "/gifts/neon-heart.svg",
  },
  {
    key: "smart-crown",
    name: "Умная корона",
    cost: 95,
    description: "Подчёркивает лидерство, идеи и умение тащить сложное.",
    imageUrl: "/gifts/smart-crown.svg",
  },
  {
    key: "rocket-pass",
    name: "Ракетный пропуск",
    cost: 135,
    description: "Для тех, кто ускоряет запуск, релиз или всю команду.",
    imageUrl: "/gifts/rocket-pass.svg",
  },
  {
    key: "aurora-crystal",
    name: "Кристалл авроры",
    cost: 180,
    description: "Редкий подарок за глубокую экспертизу и красивую работу.",
    imageUrl: "/gifts/aurora-crystal.svg",
  },
  {
    key: "legend-cup",
    name: "Кубок легенды",
    cost: 250,
    description: "Максимальный уровень признания за мощный вклад и результат.",
    imageUrl: "/gifts/legend-cup.svg",
  },
] as const

export type GiftKey = (typeof giftCatalog)[number]["key"]

export const cryptoGiftKeys = ["bitcoin-vault", "ethereum-orbit", "ton-comet", "sad-token"] as const

export const cryptoGiftCatalog = giftCatalog.filter((gift) =>
  (cryptoGiftKeys as readonly string[]).includes(gift.key)
)

export function getGiftByKey(key: string) {
  return giftCatalog.find((gift) => gift.key === key) ?? null
}

export function hasInfiniteStars(role?: string | null) {
  return hasAdministrativeAccess(role)
}
