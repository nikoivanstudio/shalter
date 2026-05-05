import { type NextRequest, NextResponse } from "next/server"

import { getViewedContactProfile } from "@/features/contacts/lib/viewed-profile"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"

function parseContactUserId(value: string) {
  const contactUserId = Number(value)
  return Number.isInteger(contactUserId) && contactUserId > 0 ? contactUserId : null
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contactUserId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { contactUserId: rawContactUserId } = await context.params
  const contactUserId = parseContactUserId(rawContactUserId)
  if (!contactUserId) {
    return NextResponse.json({ message: "Некорректный пользователь" }, { status: 400 })
  }

  const result = await getViewedContactProfile(userId, contactUserId)
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status })
  }

  return NextResponse.json({ profile: result.profile }, { status: 200 })
}
