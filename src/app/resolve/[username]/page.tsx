import { redirect } from "next/navigation"

import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { prisma } from "@/shared/lib/db/prisma"
import { normalizeUsername } from "@/shared/lib/usernames"

export default async function ResolveUsernamePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username: rawUsername } = await params
  const username = normalizeUsername(rawUsername.replace(/^@+/, ""))
  const currentUser = await getCurrentUser()

  if (!username) {
    redirect("/chats")
  }

  const record = await prisma.usernameRegistry.findUnique({
    where: { username },
    select: {
      entityType: true,
      entityId: true,
    },
  })

  if (!record) {
    redirect("/chats")
  }

  if (record.entityType === "user") {
    if (currentUser?.id === record.entityId) {
      redirect("/")
    }
    redirect(`/chats?contactId=${record.entityId}`)
  }

  if (record.entityType === "channel") {
    redirect(`/channels?channelId=${record.entityId}`)
  }

  if (record.entityType === "bot") {
    redirect(`/chats?botId=${record.entityId}`)
  }

  redirect("/chats")
}
