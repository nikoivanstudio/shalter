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

function getVapidConfig() {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? null
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? null
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@shalter.local"

  if (!publicKey || !privateKey) {
    return null
  }

  return { publicKey, privateKey, subject }
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
  return getVapidConfig()?.publicKey ?? null
}

export function isPushConfigured() {
  return Boolean(getVapidConfig())
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
