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
  const { languagePreference, setLanguage, tr } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={tr("Переключить язык")}
            title={tr("Переключить язык")}
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
          {tr("Системный язык")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage("ru")}
          data-active={languagePreference === "ru" ? "" : undefined}
        >
          {tr("Русский")}
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
