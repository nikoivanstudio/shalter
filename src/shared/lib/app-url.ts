import { type NextRequest } from "next/server"

function getFirstDefinedEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) {
      return value
    }
  }

  return null
}

export function getAppUrlFromRequest(request?: NextRequest) {
  const explicitUrl = getFirstDefinedEnv("APP_URL", "NEXT_PUBLIC_APP_URL", "SITE_URL")
  if (explicitUrl) {
    return explicitUrl.replace(/\/+$/, "")
  }

  const forwardedProto = request?.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const host = request?.headers.get("x-forwarded-host") ?? request?.headers.get("host")
  if (host) {
    return `${forwardedProto || "https"}://${host}`.replace(/\/+$/, "")
  }

  return "http://localhost:3000"
}
