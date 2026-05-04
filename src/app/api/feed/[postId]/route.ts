import { type NextRequest, NextResponse } from "next/server"

import { hasAdministrativeAccess } from "@/shared/lib/auth/roles"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"
import { deleteUploadedFileByUrl } from "@/shared/lib/media/uploads"

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

  const [post, requester] = await Promise.all([
    prisma.newsPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        mediaUrl: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
  ])

  if (!post) {
    return NextResponse.json({ message: "Публикация не найдена" }, { status: 404 })
  }

  if (post.authorId !== userId && !hasAdministrativeAccess(requester?.role)) {
    return NextResponse.json(
      { message: "Можно удалять только свои публикации" },
      { status: 403 }
    )
  }

  await prisma.newsPost.delete({
    where: { id: postId },
  })
  await deleteUploadedFileByUrl(post.mediaUrl)

  return NextResponse.json({ ok: true }, { status: 200 })
}
