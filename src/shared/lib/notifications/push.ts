import webpush from "web-push"

import { prisma } from "@/shared/lib/db/prisma"

type BrowserPushSubscription = {
  endpoint: string
  expirationTime?: number | null
  keys?: {
    p256dh?: string
    auth?: string
  }
}

let vapidConfigured = false

function getFirstDefinedEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) {
      return value
    }
  }

  return null
}

function normalizeVapidSubject(value: string | null) {
  if (!value) {
    return "mailto:admin@shalter.local"
  }

  return value.includes(":") ? value : `mailto:${value}`
}

function getVapidConfigState() {
  const publicKey = getFirstDefinedEnv(
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    "VAPID_PUBLIC_KEY",
    "NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY",
    "WEB_PUSH_PUBLIC_KEY"
  )
  const privateKey = getFirstDefinedEnv("VAPID_PRIVATE_KEY", "WEB_PUSH_PRIVATE_KEY")
  const subject = normalizeVapidSubject(
    getFirstDefinedEnv("VAPID_SUBJECT", "WEB_PUSH_SUBJECT", "WEB_PUSH_EMAIL")
  )

  const missing: string[] = []
  if (!publicKey) {
    missing.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY or VAPID_PUBLIC_KEY")
  }
  if (!privateKey) {
    missing.push("VAPID_PRIVATE_KEY")
  }

  return {
    publicKey,
    privateKey,
    subject,
    missing,
  }
}

function getVapidConfig() {
  const config = getVapidConfigState()

  if (!config.publicKey || !config.privateKey) {
    return null
  }

  return {
    publicKey: config.publicKey,
    privateKey: config.privateKey,
    subject: config.subject,
  }
}

function ensureVapidConfigured() {
  if (vapidConfigured) {
    return
  }

  const config = getVapidConfig()
  if (!config) {
    return
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
  vapidConfigured = true
}

export function getPublicVapidKey() {
  return getVapidConfigState().publicKey
}

export function isPushConfigured() {
  return Boolean(getVapidConfig())
}

export function getPushConfigurationError() {
  const { missing } = getVapidConfigState()

  if (missing.length === 0) {
    return null
  }

  return `Push уведомления не настроены: отсутствует ${missing.join(", ")}`
}

export async function savePushSubscription(
  userId: number,
  subscription: BrowserPushSubscription
) {
  const p256dh = subscription.keys?.p256dh
  const auth = subscription.keys?.auth
  if (!subscription.endpoint || !p256dh || !auth) {
    throw new Error("Invalid push subscription")
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      userId,
      p256dh,
      auth,
      expirationTime:
        typeof subscription.expirationTime === "number"
          ? BigInt(subscription.expirationTime)
          : null,
    },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh,
      auth,
      expirationTime:
        typeof subscription.expirationTime === "number"
          ? BigInt(subscription.expirationTime)
          : null,
    },
  })
}

export async function removePushSubscription(userId: number, endpoint: string) {
  await prisma.pushSubscription.deleteMany({
    where: {
      userId,
      endpoint,
    },
  })
}

export async function sendPushToDialogRecipients(params: {
  dialogId: number
  authorId: number
  authorName: string
  content: string
}) {
  if (!isPushConfigured()) {
    return
  }

  ensureVapidConfigured()

  const recipients = await prisma.pushSubscription.findMany({
    where: {
      userId: {
        not: params.authorId,
      },
      user: {
        dialogs: {
          some: {
            id: params.dialogId,
          },
        },
      },
    },
  })

  if (recipients.length === 0) {
    return
  }

  const payload = JSON.stringify({
    title: params.authorName,
    body: params.content,
    url: `/chats?dialogId=${params.dialogId}`,
    dialogId: params.dialogId,
  })

  await Promise.all(
    recipients.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload
        )
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.deleteMany({
            where: { endpoint: subscription.endpoint },
          })
        }
      }
    })
  )
}

export async function sendPushToCallRecipients(params: {
  dialogId: number
  callerId: number
  callerName: string
  media: "audio" | "video"
  callerAvatarUrl?: string | null
}) {
  if (!isPushConfigured()) {
    return
  }

  ensureVapidConfigured()

  const recipients = await prisma.pushSubscription.findMany({
    where: {
      userId: {
        not: params.callerId,
      },
      user: {
        dialogs: {
          some: {
            id: params.dialogId,
          },
        },
      },
    },
  })

  if (recipients.length === 0) {
    return
  }

  const payload = JSON.stringify({
    title: params.callerName,
    body:
      params.media === "video"
        ? "Входящий видеозвонок"
        : "Входящий аудиозвонок",
    url: `/chats?dialogId=${params.dialogId}`,
    dialogId: params.dialogId,
    type: "incoming-call",
    tag: `call-${params.dialogId}`,
    requireInteraction: true,
    renotify: true,
    silent: false,
    icon: params.callerAvatarUrl || "/icon-192x192.png",
    image: params.callerAvatarUrl || "/icon-512x512.png",
  })

  await Promise.all(
    recipients.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload
        )
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.deleteMany({
            where: { endpoint: subscription.endpoint },
          })
        }
      }
    })
  )
}
