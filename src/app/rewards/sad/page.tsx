import { redirect } from "next/navigation"

import { Providers } from "@/app/providers"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import { SadMarketHome } from "@/features/rewards/ui/sad-market-home"
import { getCurrentUser } from "@/shared/lib/auth/current-user"

export default async function SadRewardsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  return (
    <Providers>
      <PwaRegisterClient />
      <SadMarketHome
        user={{
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          starsBalance: user.starsBalance,
        }}
      />
    </Providers>
  )
}
