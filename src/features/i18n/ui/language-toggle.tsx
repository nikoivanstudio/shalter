"use client"

import { LanguagesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useI18n } from "@/features/i18n/model/i18n-provider"

export function LanguageToggle() {
  const { language, languagePreference, setLanguage, tr } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={tr("РџРµСЂРµРєР»СЋС‡РёС‚СЊ СЏР·С‹Рє")}
            title={tr("РџРµСЂРµРєР»СЋС‡РёС‚СЊ СЏР·С‹Рє")}
          />
        }
      >
        <LanguagesIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setLanguage("system")}
          data-active={languagePreference === "system" ? "" : undefined}
        >
          {language === "ru" ? "Системный язык" : "System language"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage("ru")}
          data-active={languagePreference === "ru" ? "" : undefined}
        >
          Русский
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage("en")}
          data-active={languagePreference === "en" ? "" : undefined}
        >
          English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
