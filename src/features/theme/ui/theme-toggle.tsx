"use client"

import { MoonIcon, SunIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useI18n } from "@/features/i18n/model/i18n-provider"
import { useTheme } from "@/features/theme/model/theme-provider"

export function ThemeToggle() {
  const { setTheme } = useTheme()
  const { tr } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon-sm" aria-label={tr("Переключить тему")} />}
      >
        <SunIcon className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
        <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>{tr("Светлая")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>{tr("Тёмная")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>{tr("Системная")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
