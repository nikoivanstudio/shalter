import { hasAdministrativeAccess } from "@/shared/lib/auth/roles"

export const PARTNER_REWARD_STARS = 25

export const giftCatalog = [
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

export function getGiftByKey(key: string) {
  return giftCatalog.find((gift) => gift.key === key) ?? null
}

export function hasInfiniteStars(role?: string | null) {
  return hasAdministrativeAccess(role)
}
