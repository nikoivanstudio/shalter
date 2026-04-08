import { type NextRequest, NextResponse } from "next/server"

import { createChatSchema } from "@/features/chats/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

async function hasDialogTitleColumn(db: Pick<typeof prisma, "$queryRaw">) {
  const result = await db.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'dialogs'
        AND column_name = 'title'
    ) AS "exists"
  `

  return Boolean(result[0]?.exists)
}

export async function POST(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const json = await request.json().catch(() => null)
  const parsed = createChatSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Ошибка валидации",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const participantIds = Array.from(
    new Set(parsed.data.participantIds.filter((id) => id !== userId))
  )
  const title = parsed.data.title?.trim() || null

  if (participantIds.length === 0) {
    return NextResponse.json(
      { message: "Нужно выбрать хотя бы одного пользователя из контактов" },
      { status: 400 }
    )
  }

  const allowedContacts = await prisma.contact.findMany({
    where: {
      ownerId: userId,
      contactUserId: { in: participantIds },
    },
    select: { contactUserId: true },
  })

  if (allowedContacts.length !== participantIds.length) {
    return NextResponse.json(
      { message: "Можно добавлять в чат только пользователей из контактов" },
      { status: 400 }
    )
  }

  const isPrivateChat = participantIds.length === 1
  if (isPrivateChat) {
    const otherUserId = participantIds[0]
    const existingDialog = await prisma.dialog.findFirst({
      where: {
        users: {
          some: { id: userId },
        },
        AND: [
          { users: { some: { id: otherUserId } } },
          {
            users: {
              every: {
                id: { in: [userId, otherUserId] },
              },
            },
          },
        ],
      },
      select: { id: true },
    })

    if (existingDialog) {
      return NextResponse.json(
        {
          existing: true,
          dialogId: existingDialog.id,
        },
        { status: 200 }
      )
    }
  }

  const isGroupChat = participantIds.length >= 2
  if (isGroupChat && !title) {
    return NextResponse.json(
      { message: "Для группового чата укажите название" },
      { status: 400 }
    )
  }

  const dialogTitleColumnExists = await hasDialogTitleColumn(prisma)

  const dialog = await prisma.$transaction(async (tx) => {
    const created = await tx.dialog.create({
      data: {
        ownerId: userId,
        users: {
          connect: [{ id: userId }, ...participantIds.map((id) => ({ id }))],
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
      },
    })

    if (title && dialogTitleColumnExists) {
      await tx.$executeRaw`
        UPDATE "dialogs"
        SET "title" = ${title}
        WHERE "id" = ${created.id}
      `
    }

    return created
  })

  return NextResponse.json(
    {
      dialog: {
        id: dialog.id,
        ownerId: dialog.ownerId,
        title,
        users: dialog.users,
        lastMessage: null,
      },
    },
    { status: 201 }
  )
}
