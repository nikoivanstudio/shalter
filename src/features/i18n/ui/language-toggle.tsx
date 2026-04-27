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
  const { language, setLanguage, tr } = useI18n()

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
          onClick={() => setLanguage("ru")}
          data-active={language === "ru" ? "" : undefined}
        >
          Русский
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage("en")}
          data-active={language === "en" ? "" : undefined}
        >
          English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
