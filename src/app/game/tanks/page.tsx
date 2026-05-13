import { redirect } from "next/navigation"

import { Providers } from "@/app/providers"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import { TankGameHome } from "@/features/tank-game/ui/tank-game-home"
import { getCurrentUser } from "@/shared/lib/auth/current-user"

export default async function TankGamePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  return (
    <Providers>
      <PwaRegisterClient />
      <TankGameHome playerId={String(user.id)} displayName={user.firstName || user.username} />
    </Providers>
  )
}
