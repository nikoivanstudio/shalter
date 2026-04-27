"use client"

import { LogOutIcon } from "lucide-react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/features/i18n/model/i18n-provider"

function LogoutButtonInner() {
  const router = useRouter()
  const { tr } = useI18n()
  const [isPending, startTransition] = useTransition()

  function logout() {
    startTransition(async () => {
      const response = await fetch("/api/auth/logout", { method: "POST" })
      if (!response.ok) {
        toast.error(tr("Не удалось завершить сессию"))
        return
      }

      toast.success(tr("Вы вышли из аккаунта"))
      router.replace("/auth")
      router.refresh()
    })
  }

  return (
    <Button
      size="icon"
      variant="outline"
      onClick={logout}
      disabled={isPending}
      aria-label={isPending ? tr("Выходим") : tr("Выйти")}
      title={isPending ? tr("Выходим") : tr("Выйти")}
    >
      <LogOutIcon className="size-4" />
    </Button>
  )
}

export const LogoutButton = dynamic(async () => LogoutButtonInner, {
  ssr: false,
  loading: () => <div className="size-8 shrink-0" aria-hidden="true" />,
})
