import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"

import { ChatsHomeClient } from "@/features/chats/ui/chats-home-client"
import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { prisma } from "@/shared/lib/db/prisma"

function isDialogTitleColumnMissing(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false
  }

  if (error.code !== "P2022") {
    return false
  }

  const message = String(error.message ?? "").toLowerCase()
  return message.includes("dialogs.title") || message.includes("column")
}

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

  let dialogs: Array<{
    id: number
    ownerId: number
    title: string | null
    users: Array<{
      id: number
      firstName: string
      lastName: string | null
      email: string
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
  }>

  try {
    dialogs = await prisma.dialog.findMany({
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
  } catch (error) {
    if (!isDialogTitleColumnMissing(error)) {
      throw error
    }

    const dialogsWithoutTitle = await prisma.dialog.findMany({
      where: {
        users: {
          some: { id: user.id },
        },
      },
      select: {
        id: true,
        ownerId: true,
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

    dialogs = dialogsWithoutTitle.map((dialog) => ({
      ...dialog,
      title: null,
    }))
  }

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
    <ChatsHomeClient
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
        title: dialog.title,
        users: dialog.users,
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
  )
}
