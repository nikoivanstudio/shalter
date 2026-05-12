import { redirect } from "next/navigation"

import { Providers } from "@/app/providers"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import { RewardsHome } from "@/features/rewards/ui/rewards-home"
import { getCurrentUser } from "@/shared/lib/auth/current-user"

export default async function RewardsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  return (
    <Providers>
      <PwaRegisterClient />
      <RewardsHome
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
