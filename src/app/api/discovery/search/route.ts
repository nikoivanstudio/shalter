import { type NextRequest, NextResponse } from "next/server"

import { getBlacklistIds } from "@/shared/lib/blacklist"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

export async function GET(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const normalizedQuery = q.startsWith("@") ? q.slice(1) : q

  if (!normalizedQuery) {
    return NextResponse.json({ users: [], bots: [], channels: [] }, { status: 200 })
  }

  const [users, ownedContacts, blacklistIds, bots, channels] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { not: userId },
        OR: [
          { username: { contains: normalizedQuery, mode: "insensitive" } },
          { phone: { contains: normalizedQuery, mode: "insensitive" } },
          { firstName: { contains: normalizedQuery, mode: "insensitive" } },
          { lastName: { contains: normalizedQuery, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        role: true,
        avatarTone: true,
        avatarUrl: true,
        isBlocked: true,
      },
      take: 20,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.contact.findMany({
      where: { ownerId: userId },
      select: { contactUserId: true },
    }),
    getBlacklistIds(userId),
    prisma.botPublication.findMany({
      where: {
        isBlocked: false,
        OR: [
          { username: { contains: normalizedQuery, mode: "insensitive" } },
          { name: { contains: normalizedQuery, mode: "insensitive" } },
          { niche: { contains: normalizedQuery, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        niche: true,
        avatarUrl: true,
      },
      take: 20,
      orderBy: [{ name: "asc" }, { publishedAt: "desc" }],
    }),
    prisma.channel.findMany({
      where: {
        OR: [
          { username: { contains: normalizedQuery, mode: "insensitive" } },
          { title: { contains: normalizedQuery, mode: "insensitive" } },
          { description: { contains: normalizedQuery, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        username: true,
        title: true,
        description: true,
        avatarUrl: true,
        ownerId: true,
        _count: { select: { participants: true } },
        participants: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
      },
      take: 20,
      orderBy: [{ title: "asc" }, { id: "desc" }],
    }),
  ])

  const contactIds = new Set(ownedContacts.map((contact) => contact.contactUserId))

  return NextResponse.json(
    {
      users: users.map((user) => ({
        ...user,
        isAlreadyContact: contactIds.has(user.id),
        isBlacklisted: blacklistIds.has(user.id),
      })),
      bots,
      channels: channels.map((channel) => ({
        id: channel.id,
        username: channel.username,
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
