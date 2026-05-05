import { type NextRequest, NextResponse } from "next/server"

import { publishBotSchema } from "@/features/bots/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"
import { isPrismaKnownRequestError } from "@/shared/lib/db/prisma-errors"
import { normalizeUsername, reserveUsername } from "@/shared/lib/usernames"

export async function POST(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const json = await request.json().catch(() => null)
  const parsed = publishBotSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Ошибка валидации",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  try {
    const publication = await prisma.$transaction(async (tx) => {
      const created = await tx.botPublication.create({
        data: {
          ownerId: userId,
          name: parsed.data.config.name,
          username: normalizeUsername(parsed.data.config.username),
          niche: parsed.data.config.niche || null,
          audience: parsed.data.audience,
          config: parsed.data.config,
        },
      })

      await reserveUsername(tx, parsed.data.config.username, "bot", created.id)
      return created
    })

    return NextResponse.json(
      {
        bot: {
          id: publication.id,
          name: publication.name,
          username: publication.username,
          niche: publication.niche,
          audience: publication.audience,
          publishedAt: publication.publishedAt.toISOString(),
          config: publication.config,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (isPrismaKnownRequestError(error, "P2002")) {
      const targets = Array.isArray(error.meta?.target) ? error.meta.target : []
      if (targets.includes("username") || targets.includes("username_registry_username_key")) {
        return NextResponse.json(
          {
            message: "Р­С‚РѕС‚ username Р±РѕС‚Р° СѓР¶Рµ Р·Р°РЅСЏС‚",
            fieldErrors: {
              username: ["Р­С‚РѕС‚ username Р±РѕС‚Р° СѓР¶Рµ Р·Р°РЅСЏС‚"],
            },
          },
          { status: 409 }
        )
      }
    }

    throw error
  }
}
