import { getCountryFromPhone } from "@/shared/lib/geo/country"

export function CountryFlagBadge({
  phone,
  className = "",
}: {
  phone?: string | null
  className?: string
}) {
  const country = getCountryFromPhone(phone)

  if (!country) {
    return null
  }

  return (
    <span
      title={country.name}
      aria-label={country.name}
      className={`inline-flex items-center rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-xs ${className}`.trim()}
    >
      <span aria-hidden="true">{country.flag}</span>
    </span>
  )
}
