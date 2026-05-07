export type CountryInfo = {
  code: string
  name: string
  flag: string
  dialCode: string
}

export const PHONE_COUNTRIES: CountryInfo[] = [
  { code: "RU", name: "Россия", flag: "🇷🇺", dialCode: "7" },
  { code: "KZ", name: "Казахстан", flag: "🇰🇿", dialCode: "7" },
  { code: "US", name: "США", flag: "🇺🇸", dialCode: "1" },
  { code: "UZ", name: "Узбекистан", flag: "🇺🇿", dialCode: "998" },
  { code: "KG", name: "Киргизия", flag: "🇰🇬", dialCode: "996" },
  { code: "GE", name: "Грузия", flag: "🇬🇪", dialCode: "995" },
  { code: "AZ", name: "Азербайджан", flag: "🇦🇿", dialCode: "994" },
  { code: "TM", name: "Туркменистан", flag: "🇹🇲", dialCode: "993" },
  { code: "TJ", name: "Таджикистан", flag: "🇹🇯", dialCode: "992" },
  { code: "UA", name: "Украина", flag: "🇺🇦", dialCode: "380" },
  { code: "BY", name: "Беларусь", flag: "🇧🇾", dialCode: "375" },
  { code: "AM", name: "Армения", flag: "🇦🇲", dialCode: "374" },
  { code: "MD", name: "Молдова", flag: "🇲🇩", dialCode: "373" },
  { code: "EE", name: "Эстония", flag: "🇪🇪", dialCode: "372" },
  { code: "LV", name: "Латвия", flag: "🇱🇻", dialCode: "371" },
  { code: "LT", name: "Литва", flag: "🇱🇹", dialCode: "370" },
  { code: "TR", name: "Турция", flag: "🇹🇷", dialCode: "90" },
  { code: "CN", name: "Китай", flag: "🇨🇳", dialCode: "86" },
  { code: "KR", name: "Южная Корея", flag: "🇰🇷", dialCode: "82" },
  { code: "JP", name: "Япония", flag: "🇯🇵", dialCode: "81" },
  { code: "DE", name: "Германия", flag: "🇩🇪", dialCode: "49" },
  { code: "PL", name: "Польша", flag: "🇵🇱", dialCode: "48" },
  { code: "GB", name: "Великобритания", flag: "🇬🇧", dialCode: "44" },
  { code: "IT", name: "Италия", flag: "🇮🇹", dialCode: "39" },
  { code: "ES", name: "Испания", flag: "🇪🇸", dialCode: "34" },
  { code: "FR", name: "Франция", flag: "🇫🇷", dialCode: "33" },
] as const

export function normalizePhone(phone: string | null | undefined) {
  if (!phone) {
    return ""
  }

  const trimmed = phone.trim()
  const withInternationalPrefix = trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed
  return withInternationalPrefix.replace(/[^\d+]/g, "")
}

export function getCountryByCode(code: string | null | undefined) {
  if (!code) {
    return null
  }

  return PHONE_COUNTRIES.find((country) => country.code === code.toUpperCase()) ?? null
}

export function getDefaultCountryByLocale(locale: string | null | undefined) {
  const normalized = (locale ?? "").toLowerCase()

  if (normalized.includes("-kz")) return getCountryByCode("KZ")
  if (normalized.includes("-us")) return getCountryByCode("US")
  if (normalized.includes("-ua")) return getCountryByCode("UA")
  if (normalized.includes("-by")) return getCountryByCode("BY")
  if (normalized.includes("-uz")) return getCountryByCode("UZ")
  if (normalized.includes("-kg")) return getCountryByCode("KG")
  if (normalized.includes("-ge")) return getCountryByCode("GE")
  if (normalized.includes("-am")) return getCountryByCode("AM")
  if (normalized.includes("-az")) return getCountryByCode("AZ")
  if (normalized.includes("-tr")) return getCountryByCode("TR")
  if (normalized.includes("-de")) return getCountryByCode("DE")
  if (normalized.includes("-fr")) return getCountryByCode("FR")
  if (normalized.includes("-it")) return getCountryByCode("IT")
  if (normalized.includes("-es")) return getCountryByCode("ES")
  if (normalized.includes("-gb")) return getCountryByCode("GB")
  if (normalized.startsWith("ru")) return getCountryByCode("RU")

  return getCountryByCode("RU")
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

  if (digits.length === 11 && digits.startsWith("8")) {
    return getCountryByCode("RU")
  }

  if (digits.startsWith("7")) {
    if (digits[1] === "6" || digits[1] === "7") {
      return getCountryByCode("KZ")
    }

    return getCountryByCode("RU")
  }

  if (digits.length >= 10) {
    const byPrefix = PHONE_COUNTRIES
      .slice()
      .sort((left, right) => right.dialCode.length - left.dialCode.length)
      .find((country) => digits.startsWith(country.dialCode))

    return byPrefix ?? null
  }

  return null
}
