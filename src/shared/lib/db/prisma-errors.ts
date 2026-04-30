type PrismaKnownRequestErrorLike = {
  code?: unknown
  meta?: {
    target?: unknown
  }
}

export function isPrismaKnownRequestError(
  error: unknown,
  code?: string
): error is PrismaKnownRequestErrorLike & { code: string } {
  if (!error || typeof error !== "object") {
    return false
  }

  if (!("code" in error) || typeof error.code !== "string") {
    return false
  }

  return code ? error.code === code : true
}
