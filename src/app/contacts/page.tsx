import { redirect } from "next/navigation"

import { ContactsHome } from "@/features/contacts/ui/contacts-home"
import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { prisma } from "@/shared/lib/db/prisma"

export default async function ContactsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  const contacts = await prisma.contact.findMany({
    where: { ownerId: user.id },
    select: {
      contactUser: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
    },
    orderBy: { id: "desc" },
  })

  return (
    <ContactsHome
      user={{
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      }}
      contacts={contacts.map((item) => item.contactUser)}
    />
  )
}
