import { redirect } from "next/navigation"

import { Providers } from "@/app/providers"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import { ChannelsHome } from "@/features/channels/ui/channels-home"
import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { prisma } from "@/shared/lib/db/prisma"

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ channelId?: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  const params = await searchParams
  const parsedChannelId = Number(params.channelId)
  const requestedChannelId =
    Number.isInteger(parsedChannelId) && parsedChannelId > 0 ? parsedChannelId : null

  const contacts = await prisma.contact.findMany({
    where: { ownerId: user.id },
    select: {
      contactUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isBlocked: true,
        },
      },
    },
    orderBy: { id: "desc" },
  })

  const channels = await prisma.channel.findMany({
    where: {
      participants: {
        some: {
          userId: user.id,
        },
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      ownerId: true,
      participants: {
        select: {
          role: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              isBlocked: true,
            },
          },
        },
        orderBy: { id: "asc" },
      },
      messages: {
        orderBy: { id: "desc" },
        take: 1,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  const initialChannelId =
    requestedChannelId && channels.some((channel) => channel.id === requestedChannelId)
      ? requestedChannelId
      : channels[0]?.id ?? null

  return (
    <Providers>
      <PwaRegisterClient />
      <ChannelsHome
        user={{
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          avatarTone: user.avatarTone,
        }}
        contacts={contacts.map((item) => item.contactUser)}
        initialChannelId={initialChannelId}
        channels={channels.map((channel) => ({
          id: channel.id,
          title: channel.title,
          description: channel.description,
          ownerId: channel.ownerId,
          participants: channel.participants.map((participant) => ({
            channelRole: participant.role,
            ...participant.user,
          })),
          lastMessage: channel.messages[0]
            ? {
                id: channel.messages[0].id,
                channelId: channel.messages[0].channelId,
                content: channel.messages[0].content,
                createdAt: channel.messages[0].createdAt.toISOString(),
                author: channel.messages[0].author,
              }
            : null,
        }))}
      />
    </Providers>
  )
}
