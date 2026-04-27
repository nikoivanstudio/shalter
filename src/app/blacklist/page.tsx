import { redirect } from "next/navigation"

import { Providers } from "@/app/providers"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import { BlacklistHome } from "@/features/contacts/ui/blacklist-home"
import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { prisma } from "@/shared/lib/db/prisma"

export default async function BlacklistPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  const blacklist = await prisma.userBlacklist.findMany({
    where: { ownerId: user.id },
    select: {
      blockedUser: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
        },
      },
    },
    orderBy: { id: "desc" },
  })

  return (
    <Providers>
      <PwaRegisterClient />
      <BlacklistHome
        user={{
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        }}
        blacklist={blacklist.map((item) => item.blockedUser)}
      />
    </Providers>
  )
}
