import { redirect } from "next/navigation"

import { Providers } from "@/app/providers"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import { ProfileHome } from "@/features/profile/ui/profile-home"
import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { canAssignManagedRole } from "@/shared/lib/auth/roles"
import { prisma } from "@/shared/lib/db/prisma"

export default async function Home() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  const [purchaseRequests, pendingPurchaseRequests] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        productKey: true,
        amountRub: true,
        premiumMonths: true,
        starsAmount: true,
        status: true,
        checkoutUrl: true,
        createdAt: true,
        reviewedAt: true,
      },
    }),
    canAssignManagedRole(user.role)
      ? prisma.purchaseRequest.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          take: 20,
          select: {
            id: true,
            productKey: true,
            amountRub: true,
            premiumMonths: true,
            starsAmount: true,
            status: true,
            checkoutUrl: true,
            createdAt: true,
            note: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ])

  return (
    <Providers>
      <PwaRegisterClient />
      <ProfileHome
        user={{
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          phone: user.phone,
          role: user.role,
          premiumUntil: user.premiumUntil ? user.premiumUntil.toISOString() : null,
          starsBalance: user.starsBalance,
          partnerStarsEarned: user.partnerStarsEarned,
          avatarTone: user.avatarTone,
          avatarUrl: user.avatarUrl,
          profileVisibility: user.profileVisibility,
          showEmailInProfile: user.showEmailInProfile,
          showPhoneInProfile: user.showPhoneInProfile,
          showGiftsInProfile: user.showGiftsInProfile,
        }}
        purchaseRequests={purchaseRequests.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          reviewedAt: item.reviewedAt?.toISOString() ?? null,
        }))}
        pendingPurchaseRequests={pendingPurchaseRequests.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        }))}
      />
    </Providers>
  )
}
