import { SignJWT, jwtVerify, type JWTPayload } from "jose"
import { NextResponse } from "next/server"

import { env } from "@/shared/config/env"

export const AUTH_TOKEN_COOKIE = "token"
export const AUTH_SESSION_COOKIE = "session"
export const AUTH_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

type AuthTokenPayload = JWTPayload & {
  userId: number
  email: string
  sid: string
}

const secret = new TextEncoder().encode(env.AUTH_SECRET)

export function createSessionId() {
  return crypto.randomUUID()
}

export async function createAuthToken(payload: AuthTokenPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${AUTH_MAX_AGE_SECONDS}s`)
    .sign(secret)
}

export async function verifyAuthToken(token: string) {
  try {
    const verified = await jwtVerify<AuthTokenPayload>(token, secret)
    return verified.payload
  } catch {
    return null
  }
}

export function setAuthCookies(
  response: NextResponse,
  params: { token: string; sessionId: string }
) {
  const isProduction = process.env.NODE_ENV === "production"
  const baseCookie = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
    path: "/",
    maxAge: AUTH_MAX_AGE_SECONDS,
  }

  response.cookies.set(AUTH_TOKEN_COOKIE, params.token, baseCookie)
  response.cookies.set(AUTH_SESSION_COOKIE, params.sessionId, baseCookie)
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.delete(AUTH_TOKEN_COOKIE)
  response.cookies.delete(AUTH_SESSION_COOKIE)
}
