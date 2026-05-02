type CountryInfo = {
  code: string
  name: string
  flag: string
}

const COUNTRY_BY_PREFIX: Array<{ prefix: string; country: CountryInfo }> = [
  { prefix: "998", country: { code: "UZ", name: "Узбекистан", flag: "🇺🇿" } },
  { prefix: "996", country: { code: "KG", name: "Киргизия", flag: "🇰🇬" } },
  { prefix: "995", country: { code: "GE", name: "Грузия", flag: "🇬🇪" } },
  { prefix: "994", country: { code: "AZ", name: "Азербайджан", flag: "🇦🇿" } },
  { prefix: "993", country: { code: "TM", name: "Туркменистан", flag: "🇹🇲" } },
  { prefix: "992", country: { code: "TJ", name: "Таджикистан", flag: "🇹🇯" } },
  { prefix: "380", country: { code: "UA", name: "Украина", flag: "🇺🇦" } },
  { prefix: "375", country: { code: "BY", name: "Беларусь", flag: "🇧🇾" } },
  { prefix: "374", country: { code: "AM", name: "Армения", flag: "🇦🇲" } },
  { prefix: "373", country: { code: "MD", name: "Молдова", flag: "🇲🇩" } },
  { prefix: "372", country: { code: "EE", name: "Эстония", flag: "🇪🇪" } },
  { prefix: "371", country: { code: "LV", name: "Латвия", flag: "🇱🇻" } },
  { prefix: "370", country: { code: "LT", name: "Литва", flag: "🇱🇹" } },
  { prefix: "90", country: { code: "TR", name: "Турция", flag: "🇹🇷" } },
  { prefix: "86", country: { code: "CN", name: "Китай", flag: "🇨🇳" } },
  { prefix: "82", country: { code: "KR", name: "Южная Корея", flag: "🇰🇷" } },
  { prefix: "81", country: { code: "JP", name: "Япония", flag: "🇯🇵" } },
  { prefix: "49", country: { code: "DE", name: "Германия", flag: "🇩🇪" } },
  { prefix: "48", country: { code: "PL", name: "Польша", flag: "🇵🇱" } },
  { prefix: "44", country: { code: "GB", name: "Великобритания", flag: "🇬🇧" } },
  { prefix: "39", country: { code: "IT", name: "Италия", flag: "🇮🇹" } },
  { prefix: "34", country: { code: "ES", name: "Испания", flag: "🇪🇸" } },
  { prefix: "33", country: { code: "FR", name: "Франция", flag: "🇫🇷" } },
  { prefix: "1", country: { code: "US", name: "США", flag: "🇺🇸" } },
]

function normalizePhone(phone: string | null | undefined) {
  if (!phone) {
    return ""
  }

  const trimmed = phone.trim()
  const withInternationalPrefix = trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed

  return withInternationalPrefix.replace(/[^\d+]/g, "")
}

export function getCountryFromPhone(phone: string | null | undefined): CountryInfo | null {
  const normalized = normalizePhone(phone)
  if (!normalized) {
    return null
  }

  const digits = normalized.replace(/\D/g, "")
  if (!digits) {
    return null
  }

  if (digits.length < 10) {
    return null
  }

  for (const item of COUNTRY_BY_PREFIX) {
    if (digits.startsWith(item.prefix)) {
      return item.country
    }
  }

  if (digits.length === 11 && digits.startsWith("8")) {
    return { code: "RU", name: "Россия", flag: "🇷🇺" }
  }

  if (digits.startsWith("7")) {
    if (digits[1] === "6" || digits[1] === "7") {
      return { code: "KZ", name: "Казахстан", flag: "🇰🇿" }
    }

    return { code: "RU", name: "Россия", flag: "🇷🇺" }
  }

  if (digits.length === 10) {
    return { code: "RU", name: "Россия", flag: "🇷🇺" }
  }

  return null
}
