const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

type TurnstileVerifyResult =
  | { ok: true }
  | { ok: false; message: string; errorCodes: string[] }

function getTurnstileSecret() {
  return process.env.TURNSTILE_SECRET_KEY?.trim() ?? ""
}

export function getTurnstileSiteKey() {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ""
}

export async function verifyTurnstileToken(params: {
  token: string
  remoteIp?: string | null
}): Promise<TurnstileVerifyResult> {
  const secret = getTurnstileSecret()

  if (!secret) {
    return {
      ok: false,
      message: "Turnstile не настроен на сервере",
      errorCodes: ["missing-input-secret"],
    }
  }

  const payload = new URLSearchParams({
    secret,
    response: params.token,
  })

  if (params.remoteIp) {
    payload.set("remoteip", params.remoteIp)
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
  })

  if (!response.ok) {
    return {
      ok: false,
      message: "Не удалось проверить Turnstile",
      errorCodes: ["siteverify-request-failed"],
    }
  }

  const data = (await response.json()) as {
    success?: boolean
    "error-codes"?: string[]
  }

  if (!data.success) {
    return {
      ok: false,
      message: "Проверка Turnstile не пройдена",
      errorCodes: data["error-codes"] ?? [],
    }
  }

  return { ok: true }
}
