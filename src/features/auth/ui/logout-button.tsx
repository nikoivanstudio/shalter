"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

export function LogoutButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function logout() {
    startTransition(async () => {
      const response = await fetch("/api/auth/logout", { method: "POST" })
      if (!response.ok) {
        toast.error("Не удалось завершить сессию")
        return
      }

      toast.success("Вы вышли из аккаунта")
      router.replace("/auth")
      router.refresh()
    })
  }

  return (
    <Button variant="outline" onClick={logout} disabled={isPending}>
      {isPending ? "Выходим..." : "Выйти"}
    </Button>
  )
}
