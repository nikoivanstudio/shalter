import { type NextRequest, NextResponse } from "next/server"

import { recordAdCampaignClick } from "@/features/ads/lib/store"

function parseAdId(value: string) {
  const adId = Number(value)
  return Number.isInteger(adId) && adId > 0 ? adId : null
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ adId: string }> }
) {
  const { adId: rawAdId } = await context.params
  const adId = parseAdId(rawAdId)
  if (!adId) {
    return NextResponse.json({ message: "Некорректная реклама" }, { status: 400 })
  }

  await recordAdCampaignClick(adId)
  return NextResponse.json({ ok: true }, { status: 200 })
}
