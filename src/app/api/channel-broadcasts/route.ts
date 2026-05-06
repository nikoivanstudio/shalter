import { type NextRequest, NextResponse } from "next/server"

import {
  createBroadcast,
  type BroadcastMediaMode,
} from "@/features/channels/lib/broadcast-store"

import {
  getAuthorizedBroadcastContext,
  getChannelMembersForBroadcasts,
} from "./_lib"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const auth = await getAuthorizedBroadcastContext(request)
  if ("error" in auth) {
    return auth.error
  }

  const body = (await request.json().catch(() => null)) as
    | { channelId?: number; media?: BroadcastMediaMode }
    | null

  const channelId =
    typeof body?.channelId === "number" && Number.isInteger(body.channelId) && body.channelId > 0
      ? body.channelId
      : null
  const media = body?.media === "video" ? "video" : body?.media === "audio" ? "audio" : null

  if (!channelId || !media) {
    return NextResponse.json({ message: "Некорректные параметры эфира" }, { status: 400 })
  }

  const channel = await getChannelMembersForBroadcasts(channelId)
  if (!channel) {
    return NextResponse.json({ message: "Канал не найден" }, { status: 404 })
  }

  const membership = channel.participants.find((item) => item.user.id === auth.userId) ?? null
  if (!membership) {
    return NextResponse.json({ message: "Канал не найден" }, { status: 404 })
  }

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return NextResponse.json(
      { message: "Запускать трансляцию могут только владелец и админы канала" },
      { status: 403 }
    )
  }

  const broadcast = createBroadcast({
    channelId,
    media,
    host: auth.user,
    members: channel.participants.map((item) => ({
      userId: item.user.id,
      firstName: item.user.firstName,
      lastName: item.user.lastName,
      email: item.user.email,
      avatarTone: item.user.avatarTone,
      avatarUrl: item.user.avatarUrl,
    })),
  })

  return NextResponse.json({ broadcast }, { status: 201 })
}
