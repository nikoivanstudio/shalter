import { NextResponse, type NextRequest } from "next/server"

import {
  AUTH_SESSION_COOKIE,
  AUTH_TOKEN_COOKIE,
  verifyAuthToken,
} from "@/shared/lib/auth/session"

async function isAuthorized(request: NextRequest) {
  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value
  const sessionId = request.cookies.get(AUTH_SESSION_COOKIE)?.value

  if (!token || !sessionId) {
    return false
  }

  const payload = await verifyAuthToken(token)
  if (!payload) {
    return false
  }

  return payload.sid === sessionId
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const authorized = await isAuthorized(request)

  if (pathname === "/auth" && authorized) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (pathname === "/" && !authorized) {
    return NextResponse.redirect(new URL("/auth", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/auth"],
}
