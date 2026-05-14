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

  if (/^\/@[a-z0-9_]{4,32}$/i.test(pathname)) {
    const nextUrl = request.nextUrl.clone()
    nextUrl.pathname = `/resolve/${pathname.slice(2)}`
    return NextResponse.rewrite(nextUrl)
  }

  const authorized = await isAuthorized(request)
  const protectedRoutes = ["/", "/contacts", "/chats", "/channels", "/resolve"]

  if (pathname === "/auth" && authorized) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (
    (protectedRoutes.includes(pathname) ||
      pathname.startsWith("/resolve/") ||
      pathname.startsWith("/chat/")) &&
    !authorized
  ) {
    return NextResponse.redirect(new URL("/auth", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
}
