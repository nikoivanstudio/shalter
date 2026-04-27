import { type NextRequest, NextResponse } from "next/server"

import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

function parsePostId(value: string) {
  const postId = Number(value)
  return Number.isInteger(postId) && postId > 0 ? postId : null
}

export async function DELETE(
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
    return NextResponse.json({ message: "Некорректная публикация" }, { status: 400 })
  }

  const post = await prisma.newsPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
    },
  })

  if (!post) {
    return NextResponse.json({ message: "Публикация не найдена" }, { status: 404 })
  }

  if (post.authorId !== userId) {
    return NextResponse.json({ message: "Можно удалять только свои публикации" }, { status: 403 })
  }

  await prisma.newsPost.delete({
    where: { id: postId },
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
