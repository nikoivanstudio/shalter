import { type NextRequest, NextResponse } from "next/server"

import { createNewsPostSchema } from "@/features/feed/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

export async function POST(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const json = await request.json().catch(() => null)
  const parsed = createNewsPostSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Ошибка валидации",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const post = await prisma.newsPost.create({
    data: {
      authorId: userId,
      content: parsed.data.content,
    },
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
  })

  return NextResponse.json(
    {
      post: {
        id: post.id,
        content: post.content,
        createdAt: post.createdAt.toISOString(),
        author: post.author,
        likesCount: 0,
        likedByMe: false,
        comments: [],
      },
    },
    { status: 201 }
  )
}
