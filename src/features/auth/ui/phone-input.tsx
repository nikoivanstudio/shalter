"use client"

import { ChevronDownIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  getCountryByCode,
  getCountryFromPhone,
  getDefaultCountryByLocale,
  normalizePhone,
  PHONE_COUNTRIES,
} from "@/shared/lib/geo/country"

function replaceDialCode(phone: string, nextDialCode: string) {
  const normalized = normalizePhone(phone)
  const detected = getCountryFromPhone(normalized)
  const digits = normalized.replace(/\D/g, "")

  if (!digits) {
    return `+${nextDialCode}`
  }

  if (detected && digits.startsWith(detected.dialCode)) {
    return `+${nextDialCode}${digits.slice(detected.dialCode.length)}`
  }

  if (digits.startsWith("8") && digits.length === 11) {
    return `+${nextDialCode}${digits.slice(1)}`
  }

  if (!normalized.startsWith("+")) {
    return `+${nextDialCode}${digits}`
  }

  return `+${nextDialCode}`
}

export function PhoneInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete = "tel",
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  const [preferredCountryCode, setPreferredCountryCode] = useState(() => {
    if (typeof navigator === "undefined") {
      return "RU"
    }

    return getDefaultCountryByLocale(navigator.language)?.code ?? "RU"
  })

  const activeCountry = useMemo(() => {
    return (
      getCountryFromPhone(value) ??
      getCountryByCode(preferredCountryCode) ??
      getCountryByCode("RU")
    )
  }, [preferredCountryCode, value])

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex min-w-28 items-center justify-between gap-2 rounded-full border border-input bg-background px-3 text-sm outline-none transition hover:bg-accent/40"
            aria-label="Выбрать страну"
          >
            <span className="inline-flex items-center gap-2">
              <span className="text-base" aria-hidden="true">
                {activeCountry?.flag ?? "🌐"}
              </span>
              <span>{activeCountry ? `+${activeCountry.dialCode}` : "+"}</span>
            </span>
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72">
            {PHONE_COUNTRIES.map((country) => (
              <DropdownMenuItem
                key={`${country.code}-${country.dialCode}`}
                onClick={() => {
                  setPreferredCountryCode(country.code)
                  onChange(replaceDialCode(value, country.dialCode))
                }}
              >
                <span className="mr-2">{country.flag}</span>
                <span className="flex-1 truncate">{country.name}</span>
                <span className="text-xs text-muted-foreground">+{country.dialCode}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Input
          id={id}
          type="tel"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder ?? `+${activeCountry?.dialCode ?? "7"}...`}
          className="flex-1"
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden="true">{activeCountry?.flag ?? "🌐"}</span>
        <span>
          {activeCountry
            ? `${activeCountry.name}, код +${activeCountry.dialCode}`
            : "Страна определится по коду номера"}
        </span>
      </div>
    </div>
  )
}
