import { redirect } from "next/navigation"

import { Providers } from "@/app/providers"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import type { BotConfig } from "@/features/bots/lib/runtime"
import { BotsHome } from "@/features/bots/ui/bots-home"
import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { prisma } from "@/shared/lib/db/prisma"

export default async function BotsPage({
  searchParams,
}: {
  searchParams?: Promise<{ botId?: string }>
} = {}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  const params = (await searchParams) ?? {}
  const parsedBotId = Number(params.botId)
  const initialSelectedBotId =
    Number.isInteger(parsedBotId) && parsedBotId > 0 ? parsedBotId : null

  const publications = await prisma.botPublication.findMany({
    where: {
      OR: [{ isBlocked: false }, { ownerId: user.id }],
    },
    orderBy: { publishedAt: "desc" },
    include: {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
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
        initialSelectedBotId={initialSelectedBotId}
        publishedBots={publications.map((bot) => ({
          id: bot.id,
          name: bot.name,
          username: bot.username,
          niche: bot.niche,
          audience: bot.audience as "client" | "user",
          avatarUrl: bot.avatarUrl,
          isBlocked: bot.isBlocked,
          publishedAt: bot.publishedAt.toISOString(),
          config: bot.config as BotConfig,
          ownerId: bot.ownerId,
          ownerName:
            `${bot.owner?.firstName ?? "Автор"} ${bot.owner?.lastName ?? ""}`.trim(),
          isMine: bot.ownerId === user.id,
        }))}
      />
    </Providers>
  )
}
