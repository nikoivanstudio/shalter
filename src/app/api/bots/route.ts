import { type NextRequest, NextResponse } from "next/server"

import { publishBotSchema } from "@/features/bots/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"
import { isPrismaKnownRequestError } from "@/shared/lib/db/prisma-errors"
import { deleteUploadedFileByUrl, saveAvatarFile, validateAvatarFile } from "@/shared/lib/media/uploads"
import { normalizeUsername, reserveUsername } from "@/shared/lib/usernames"

function isFileLike(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "size" in value &&
    typeof value.size === "number" &&
    "name" in value &&
    typeof value.name === "string" &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function"
  )
}

export async function POST(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ" }, { status: 401 })
  }

  const contentType = request.headers.get("content-type") ?? ""
  let avatarFile: File | null = null
  let payload: unknown = null

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    const payloadValue = formData.get("payload")
    payload = typeof payloadValue === "string" ? JSON.parse(payloadValue) : null
    const avatarValue = formData.get("avatarFile")
    avatarFile = isFileLike(avatarValue) && avatarValue.size > 0 ? avatarValue : null
  } else {
    payload = await request.json().catch(() => null)
  }

  const parsed = publishBotSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "РћС€РёР±РєР° РІР°Р»РёРґР°С†РёРё",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  let savedAvatarUrl: string | null = null

  if (avatarFile) {
    const avatarError = validateAvatarFile(avatarFile)
    if (avatarError) {
      return NextResponse.json(
        {
          message: "РћС€РёР±РєР° РІР°Р»РёРґР°С†РёРё",
          fieldErrors: {
            avatarFile: [avatarError],
          },
        },
        { status: 400 }
      )
    }

    savedAvatarUrl = (await saveAvatarFile(avatarFile)).url
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
          avatarUrl: savedAvatarUrl,
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
          avatarUrl: publication.avatarUrl,
          isBlocked: publication.isBlocked,
          publishedAt: publication.publishedAt.toISOString(),
          config: publication.config,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    await deleteUploadedFileByUrl(savedAvatarUrl)

    if (isPrismaKnownRequestError(error, "P2002")) {
      const targets = Array.isArray(error.meta?.target) ? error.meta.target : []
      if (targets.includes("username") || targets.includes("username_registry_username_key")) {
        return NextResponse.json(
          {
            message: "Р В­РЎвЂљР С•РЎвЂљ username Р В±Р С•РЎвЂљР В° РЎС“Р В¶Р Вµ Р В·Р В°Р Р…РЎРЏРЎвЂљ",
            fieldErrors: {
              username: ["Р В­РЎвЂљР С•РЎвЂљ username Р В±Р С•РЎвЂљР В° РЎС“Р В¶Р Вµ Р В·Р В°Р Р…РЎРЏРЎвЂљ"],
            },
          },
          { status: 409 }
        )
      }
    }

    throw error
  }
}
