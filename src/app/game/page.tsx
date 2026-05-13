import { redirect } from "next/navigation"

import { Providers } from "@/app/providers"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import { GameHome } from "@/features/game/ui/game-home"
import { getCurrentUser } from "@/shared/lib/auth/current-user"

export default async function GamePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  return (
    <Providers>
      <PwaRegisterClient />
      <GameHome
        playerId={String(user.id)}
        displayName={user.firstName || user.username}
        phone={user.phone}
      />
    </Providers>
  )
}
