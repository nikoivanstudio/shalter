import { redirect } from "next/navigation"

import { Providers } from "@/app/providers"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import { ContactsHomeClient } from "@/features/contacts/ui/contacts-home-client"
import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { prisma } from "@/shared/lib/db/prisma"

export default async function ContactsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  const contacts = await prisma.contact.findMany({
    where: {
      ownerId: user.id,
      contactUser: {
        blockedByUsers: {
          none: {
            ownerId: user.id,
          },
        },
      },
    },
    select: {
      contactUser: {
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
      <ContactsHomeClient
        user={{
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        }}
        contacts={contacts.map((item) => item.contactUser)}
        blacklist={blacklist.map((item) => item.blockedUser)}
      />
    </Providers>
  )
}
