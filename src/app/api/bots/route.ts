import { type NextRequest, NextResponse } from "next/server"

import { publishBotSchema } from "@/features/bots/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

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

  const publication = await prisma.botPublication.create({
    data: {
      ownerId: userId,
      name: parsed.data.config.name,
      niche: parsed.data.config.niche || null,
      audience: parsed.data.audience,
      config: parsed.data.config,
    },
  })

  return NextResponse.json(
    {
      bot: {
        id: publication.id,
        name: publication.name,
        niche: publication.niche,
        audience: publication.audience,
        publishedAt: publication.publishedAt.toISOString(),
        config: publication.config,
      },
    },
    { status: 201 }
  )
}
