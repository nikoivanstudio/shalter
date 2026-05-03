import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

export async function GET(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (!q) {
    return NextResponse.json({ channels: [] }, { status: 200 })
  }

  const channels = await prisma.channel.findMany({
    where: {
      title: {
        contains: q,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      avatarUrl: true,
      ownerId: true,
      _count: {
        select: {
          participants: true,
        },
      },
      participants: {
        where: { userId },
        select: {
          role: true,
        },
        take: 1,
      },
    },
    take: 20,
    orderBy: [{ title: "asc" }, { id: "desc" }],
  })

  return NextResponse.json(
    {
      channels: channels.map((channel) => ({
        id: channel.id,
        title: channel.title,
        description: channel.description,
        avatarUrl: channel.avatarUrl,
        ownerId: channel.ownerId,
        memberCount: channel._count.participants,
        joined: channel.participants.length > 0,
        myRole: channel.participants[0]?.role ?? null,
      })),
    },
    { status: 200 }
  )
}
