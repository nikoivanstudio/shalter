import { type NextRequest, NextResponse } from "next/server"

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

  const existingLike = await prisma.newsPostLike.findUnique({
    where: {
      postId_userId: {
        postId,
        userId,
      },
    },
    select: { id: true },
  })

  if (existingLike) {
    await prisma.newsPostLike.delete({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    })
  } else {
    await prisma.newsPostLike.create({
      data: {
        postId,
        userId,
      },
    })
  }

  const likesCount = await prisma.newsPostLike.count({
    where: { postId },
  })

  return NextResponse.json(
    {
      likedByMe: !existingLike,
      likesCount,
    },
    { status: 200 }
  )
}
