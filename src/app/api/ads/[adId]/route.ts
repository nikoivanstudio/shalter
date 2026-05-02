import { type NextRequest, NextResponse } from "next/server"

import {
  deleteAdCampaign,
  getOwnedAdCampaign,
  updateAdCampaignStatus,
} from "@/features/ads/lib/store"
import { updateAdCampaignSchema } from "@/features/ads/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"

function parseAdId(value: string) {
  const adId = Number(value)
  return Number.isInteger(adId) && adId > 0 ? adId : null
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ adId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { adId: rawAdId } = await context.params
  const adId = parseAdId(rawAdId)
  if (!adId) {
    return NextResponse.json({ message: "Некорректная реклама" }, { status: 400 })
  }

  const owned = await getOwnedAdCampaign(adId, userId)
  if (!owned) {
    return NextResponse.json({ message: "Размещение не найдено" }, { status: 404 })
  }

  const json = await request.json().catch(() => null)
  const parsed = updateAdCampaignSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Ошибка валидации",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const campaign = await updateAdCampaignStatus(adId, userId, parsed.data.status)
  return NextResponse.json({ campaign }, { status: 200 })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ adId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { adId: rawAdId } = await context.params
  const adId = parseAdId(rawAdId)
  if (!adId) {
    return NextResponse.json({ message: "Некорректная реклама" }, { status: 400 })
  }

  const owned = await getOwnedAdCampaign(adId, userId)
  if (!owned) {
    return NextResponse.json({ message: "Размещение не найдено" }, { status: 404 })
  }

  await deleteAdCampaign(adId, userId)
  return NextResponse.json({ ok: true }, { status: 200 })
}
