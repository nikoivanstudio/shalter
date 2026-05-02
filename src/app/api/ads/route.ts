import { type NextRequest, NextResponse } from "next/server"

import {
  createAdCampaign,
  listAdCampaignsByOwner,
  listPublicAdCampaigns,
} from "@/features/ads/lib/store"
import { createAdCampaignSchema } from "@/features/ads/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"

export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope")
  const userId = await getAuthorizedUserIdFromRequest(request)

  if (scope === "mine") {
    if (!userId) {
      return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
    }

    const campaigns = await listAdCampaignsByOwner(userId)
    return NextResponse.json({ campaigns }, { status: 200 })
  }

  const campaigns = await listPublicAdCampaigns()
  return NextResponse.json({ campaigns }, { status: 200 })
}

export async function POST(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const json = await request.json().catch(() => null)
  const parsed = createAdCampaignSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Ошибка валидации",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const campaign = await createAdCampaign(userId, parsed.data)

  return NextResponse.json({ campaign }, { status: 201 })
}
