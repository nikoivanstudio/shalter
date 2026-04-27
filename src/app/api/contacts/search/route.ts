import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"
import { getBlacklistIds } from "@/shared/lib/blacklist"

export async function GET(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 1) {
    return NextResponse.json({ users: [] }, { status: 200 })
  }

  const [users, ownedContacts, blacklistIds] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { not: userId },
        OR: [
          { phone: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        role: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 20,
    }),
    prisma.contact.findMany({
      where: { ownerId: userId },
      select: { contactUserId: true },
    }),
    getBlacklistIds(userId),
  ])

  const contactIds = new Set(ownedContacts.map((contact) => contact.contactUserId))

  return NextResponse.json(
    {
      users: users.map((user) => ({
        ...user,
        isAlreadyContact: contactIds.has(user.id),
        isBlacklisted: blacklistIds.has(user.id),
      })),
    },
    { status: 200 }
  )
}
