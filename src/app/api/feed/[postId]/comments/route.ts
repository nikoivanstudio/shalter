import { type NextRequest, NextResponse } from "next/server"

import { createNewsCommentSchema } from "@/features/feed/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

function parsePostId(value: string) {
  const postId = Number(value)
  return Number.isInteger(postId) && postId > 0 ? postId : null
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { postId: rawPostId } = await context.params
  const postId = parsePostId(rawPostId)
  if (!postId) {
    return NextResponse.json({ message: "Неверный id публикации" }, { status: 400 })
  }

  const post = await prisma.newsPost.findUnique({
    where: { id: postId },
    select: { id: true },
  })
  if (!post) {
    return NextResponse.json({ message: "Публикация не найдена" }, { status: 404 })
  }

  const json = await request.json().catch(() => null)
  const parsed = createNewsCommentSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Ошибка валидации",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const comment = await prisma.newsPostComment.create({
    data: {
      postId,
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
          avatarTone: true,
          isBlocked: true,
        },
      },
    },
  })

  return NextResponse.json(
    {
      comment: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        author: comment.author,
      },
    },
    { status: 201 }
  )
}
