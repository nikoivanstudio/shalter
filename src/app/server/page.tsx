import { redirect } from "next/navigation"

import { Providers } from "@/app/providers"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import { ServerHome } from "@/features/server/ui/server-home"
import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { hasAdministrativeAccess } from "@/shared/lib/auth/roles"
import { getServerMetricsSnapshot } from "@/shared/lib/server/metrics"

export default async function ServerPage() {
  const user = await getCurrentUser({ touchActivity: false })

  if (!user) {
    redirect("/auth")
  }

  if (!hasAdministrativeAccess(user.role)) {
    redirect("/")
  }

  const metrics = getServerMetricsSnapshot()

  return (
    <Providers>
      <PwaRegisterClient />
      <ServerHome initialMetrics={metrics} />
    </Providers>
  )
}
