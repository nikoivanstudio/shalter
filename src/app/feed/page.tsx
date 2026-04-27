import { redirect } from "next/navigation"

import { Providers } from "@/app/providers"
import { PwaRegisterClient } from "@/app/pwa-register-client"
import { FeedHome } from "@/features/feed/ui/feed-home"
import { getCurrentUser } from "@/shared/lib/auth/current-user"
import { prisma } from "@/shared/lib/db/prisma"

export default async function FeedPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  const posts = await prisma.newsPost.findMany({
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
      likes: {
        where: { userId: user.id },
        select: { id: true },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
      },
      _count: {
        select: {
          likes: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <Providers>
      <PwaRegisterClient />
      <FeedHome
        user={{
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        }}
        posts={posts.map((post) => ({
          id: post.id,
          content: post.content,
          createdAt: post.createdAt.toISOString(),
          author: post.author,
          likesCount: post._count.likes,
          likedByMe: post.likes.length > 0,
          comments: post.comments.map((comment) => ({
            id: comment.id,
            content: comment.content,
            createdAt: comment.createdAt.toISOString(),
            author: comment.author,
          })),
        }))}
      />
    </Providers>
  )
}
