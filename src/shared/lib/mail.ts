import nodemailer from "nodemailer"

function getFirstDefinedEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) {
      return value
    }
  }

  return null
}

function parseBoolean(value: string | null, fallback: boolean) {
  if (!value) {
    return fallback
  }

  const normalized = value.toLowerCase()
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false
  }

  return fallback
}

function getMailConfig() {
  const host = getFirstDefinedEnv("SMTP_HOST", "MAIL_HOST")
  const portValue = getFirstDefinedEnv("SMTP_PORT", "MAIL_PORT")
  const user = getFirstDefinedEnv("SMTP_USER", "MAIL_USER")
  const pass = getFirstDefinedEnv("SMTP_PASS", "MAIL_PASS")
  const from = getFirstDefinedEnv("SMTP_FROM", "MAIL_FROM")
  const port = portValue ? Number(portValue) : 587
  const secure = parseBoolean(getFirstDefinedEnv("SMTP_SECURE", "MAIL_SECURE"), port === 465)

  const missing: string[] = []
  if (!host) {
    missing.push("SMTP_HOST")
  }
  if (!user) {
    missing.push("SMTP_USER")
  }
  if (!pass) {
    missing.push("SMTP_PASS")
  }
  if (!from) {
    missing.push("SMTP_FROM")
  }
  if (!Number.isFinite(port) || port <= 0) {
    missing.push("SMTP_PORT")
  }

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    missing,
  }
}

export function isMailConfigured() {
  return getMailConfig().missing.length === 0
}

export function getMailConfigurationError() {
  const { missing } = getMailConfig()
  if (missing.length === 0) {
    return null
  }

  return `Отправка email не настроена: отсутствует ${missing.join(", ")}`
}

export async function sendRecoveryCodeEmail(params: { to: string; code: string }) {
  const config = getMailConfig()
  if (config.missing.length > 0 || !config.host || !config.user || !config.pass || !config.from) {
    throw new Error(getMailConfigurationError() ?? "Mail is not configured")
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })

  await transporter.sendMail({
    from: config.from,
    to: params.to,
    subject: "Код подтверждения для сброса аккаунта",
    text: `Ваш код подтверждения: ${params.code}. Для запроса использован привязанный номер телефона. Код действует 10 минут.`,
    html: `<p>Ваш код подтверждения: <strong>${params.code}</strong></p><p>Для запроса использован привязанный номер телефона.</p><p>Код действует 10 минут.</p>`,
  })
}
