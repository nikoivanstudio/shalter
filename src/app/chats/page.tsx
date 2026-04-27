import { redirect } from "next/navigation"

import { Providers } from "@/app/providers"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import { ChatsHomeClient } from "@/features/chats/ui/chats-home-client"
import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { findUsersWhoBlockedActor } from "@/shared/lib/blacklist"
import { prisma } from "@/shared/lib/db/prisma"
import { canWriteToProtectedUser } from "@/shared/lib/direct-message-access"
import { isUserOnline } from "@/shared/lib/user-activity"

export default async function ChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ contactId?: string; dialogId?: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  const params = await searchParams
  const parsedContactId = Number(params.contactId)
  const parsedDialogId = Number(params.dialogId)
  const requestedContactId =
    Number.isInteger(parsedContactId) && parsedContactId > 0 ? parsedContactId : null
  const requestedDialogId =
    Number.isInteger(parsedDialogId) && parsedDialogId > 0 ? parsedDialogId : null

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
          role: true,
          isBlocked: true,
        },
      },
    },
    orderBy: {
      id: "desc",
    },
  })

  let initialDialogId: number | null = null

  if (requestedDialogId) {
    const allowedDialog = await prisma.dialog.findFirst({
      where: {
        id: requestedDialogId,
        users: {
          some: { id: user.id },
        },
      },
      select: { id: true },
    })

    if (allowedDialog) {
      initialDialogId = allowedDialog.id
    }
  }

  if (
    !initialDialogId &&
    requestedContactId &&
    contacts.some((item) => item.contactUser.id === requestedContactId)
  ) {
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
      const blockedBy = await findUsersWhoBlockedActor(user.id, [requestedContactId])
      if (blockedBy.length > 0) {
        redirect("/chats")
      }

      const writeAccess = await canWriteToProtectedUser(user.id, requestedContactId)
      if (!writeAccess.ok && writeAccess.code === "CONTACT_REQUIRED") {
        redirect("/chats")
      }

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

  const dialogs: Array<{
    id: number
    ownerId: number
    title: string | null
    users: Array<{
      id: number
      firstName: string
      lastName: string | null
      email: string
      role: string
      lastSeenAt: Date | null
    }>
    Messages: Array<{
      id: number
      content: string
      status: string | null
      createdAt: Date
      dialogId: number
      author: {
        id: number
        firstName: string
        lastName: string | null
      }
    }>
  }> = await prisma.dialog.findMany({
    where: {
      users: {
        some: { id: user.id },
      },
    },
    select: {
      id: true,
      ownerId: true,
      title: true,
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isBlocked: true,
          lastSeenAt: true,
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

  const unreadGroups = await prisma.message.groupBy({
    by: ["dialogId"],
    where: {
      authorId: { not: user.id },
      status: { not: "READ" },
      dialog: {
        users: {
          some: { id: user.id },
        },
      },
    },
    _count: {
      _all: true,
    },
  })
  const unreadByDialog = new Map(
    unreadGroups.map((item) => [item.dialogId, item._count._all] as const)
  )

  return (
    <Providers>
      <PwaRegisterClient />
      <ChatsHomeClient
        user={{
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          avatarTone: user.avatarTone,
        }}
        initialDialogId={initialDialogId}
        contacts={contacts.map((item) => item.contactUser)}
        dialogs={dialogs.map((dialog) => ({
          id: dialog.id,
          ownerId: dialog.ownerId,
          title: dialog.title,
          users: dialog.users.map((dialogUser) => ({
            ...dialogUser,
            lastSeenAt: dialogUser.lastSeenAt ? dialogUser.lastSeenAt.toISOString() : null,
            isOnline: isUserOnline(dialogUser.lastSeenAt),
          })),
          unreadCount: unreadByDialog.get(dialog.id) ?? 0,
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
    </Providers>
  )
}
