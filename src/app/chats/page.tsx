import { redirect } from "next/navigation"

import { ChatsHome } from "@/features/chats/ui/chats-home"
import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { prisma } from "@/shared/lib/db/prisma"

export default async function ChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ contactId?: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  const params = await searchParams
  const parsedContactId = Number(params.contactId)
  const requestedContactId =
    Number.isInteger(parsedContactId) && parsedContactId > 0 ? parsedContactId : null

  const contacts = await prisma.contact.findMany({
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
  })

  let initialDialogId: number | null = null

  if (requestedContactId && contacts.some((item) => item.contactUser.id === requestedContactId)) {
    const existingDialog = await prisma.dialog.findFirst({
      where: {
        users: {
          some: { id: user.id },
        },
        AND: [
          {
            users: {
              some: { id: requestedContactId },
            },
          },
          {
            users: {
              every: {
                id: { in: [user.id, requestedContactId] },
              },
            },
          },
        ],
      },
      select: { id: true },
    })

    if (existingDialog) {
      initialDialogId = existingDialog.id
    } else {
      const createdDialog = await prisma.dialog.create({
        data: {
          ownerId: user.id,
          users: {
            connect: [{ id: user.id }, { id: requestedContactId }],
          },
        },
        select: { id: true },
      })
      initialDialogId = createdDialog.id
    }
  }

  const dialogs = await prisma.dialog.findMany({
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
  })

  return (
    <ChatsHome
      user={{
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      }}
      initialDialogId={initialDialogId}
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
