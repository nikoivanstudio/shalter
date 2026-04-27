import { type NextRequest, NextResponse } from "next/server"

import { createChannelSchema } from "@/features/channels/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

export async function POST(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const json = await request.json().catch(() => null)
  const parsed = createChannelSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Ошибка валидации",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const channel = await prisma.channel.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description?.trim() || null,
      ownerId: userId,
      participants: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      ownerId: true,
      participants: {
        select: {
          userId: true,
          role: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              isBlocked: true,
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  })

  return NextResponse.json(
    {
      channel: {
        id: channel.id,
        title: channel.title,
        description: channel.description,
        ownerId: channel.ownerId,
        participants: channel.participants.map((participant) => ({
          channelRole: participant.role,
          ...participant.user,
        })),
        lastMessage: null,
      },
    },
    { status: 201 }
  )
}
