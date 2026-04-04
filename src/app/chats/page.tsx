import { redirect } from "next/navigation"

import { ChatsHome } from "@/features/chats/ui/chats-home"
import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { prisma } from "@/shared/lib/db/prisma"

export default async function ChatsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  const [dialogs, contacts] = await Promise.all([
    prisma.dialog.findMany({
      where: {
        users: {
          some: { id: user.id },
        },
      },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        Messages: {
          orderBy: { id: "desc" },
          take: 1,
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { id: "desc" },
    }),
    prisma.contact.findMany({
      where: { ownerId: user.id },
      select: {
        contactUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        id: "desc",
      },
    }),
  ])

  return (
    <ChatsHome
      user={{
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      }}
      contacts={contacts.map((item) => item.contactUser)}
      dialogs={dialogs.map((dialog) => ({
        id: dialog.id,
        ownerId: dialog.ownerId,
        users: dialog.users,
        lastMessage: dialog.Messages[0]
          ? {
              id: dialog.Messages[0].id,
              content: dialog.Messages[0].content,
              status: dialog.Messages[0].status,
              createdAt: dialog.Messages[0].createdAt.toISOString(),
              dialogId: dialog.Messages[0].dialogId,
              author: dialog.Messages[0].author,
            }
          : null,
      }))}
    />
  )
}
