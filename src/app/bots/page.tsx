import { redirect } from "next/navigation"

import { Providers } from "@/app/providers"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import type { BotConfig } from "@/features/bots/lib/runtime"
import { BotsHome } from "@/features/bots/ui/bots-home"
import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { prisma } from "@/shared/lib/db/prisma"

export default async function BotsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  const publications = await prisma.botPublication.findMany({
    where: { ownerId: user.id },
    orderBy: { publishedAt: "desc" },
  })

  return (
    <Providers>
      <PwaRegisterClient />
      <BotsHome
        user={{
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          avatarTone: user.avatarTone,
        }}
        publishedBots={publications.map((bot) => ({
          id: bot.id,
          name: bot.name,
          niche: bot.niche,
          audience: bot.audience as "client" | "user",
          publishedAt: bot.publishedAt.toISOString(),
          config: bot.config as BotConfig,
        }))}
      />
    </Providers>
  )
}
