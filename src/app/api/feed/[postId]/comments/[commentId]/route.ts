import { type NextRequest, NextResponse } from "next/server"

import { createNewsCommentSchema } from "@/features/feed/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"

function parsePositiveInt(value: string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

async function getComment(postId: number, commentId: number) {
  return prisma.newsPostComment.findFirst({
    where: {
      id: commentId,
      postId,
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
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ postId: string; commentId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { postId: rawPostId, commentId: rawCommentId } = await context.params
  const postId = parsePositiveInt(rawPostId)
  const commentId = parsePositiveInt(rawCommentId)
  if (!postId || !commentId) {
    return NextResponse.json({ message: "Неверные идентификаторы" }, { status: 400 })
  }

  const existing = await getComment(postId, commentId)
  if (!existing) {
    return NextResponse.json({ message: "Комментарий не найден" }, { status: 404 })
  }

  if (existing.authorId !== userId) {
    return NextResponse.json(
      { message: "Можно редактировать только свои комментарии" },
      { status: 403 }
    )
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

  const updated = await prisma.newsPostComment.update({
    where: { id: commentId },
    data: {
      content: parsed.data.content,
      updatedAt: new Date(),
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
        id: updated.id,
        content: updated.content,
        createdAt: updated.createdAt.toISOString(),
        author: updated.author,
      },
    },
    { status: 200 }
  )
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ postId: string; commentId: string }> }
) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const { postId: rawPostId, commentId: rawCommentId } = await context.params
  const postId = parsePositiveInt(rawPostId)
  const commentId = parsePositiveInt(rawCommentId)
  if (!postId || !commentId) {
    return NextResponse.json({ message: "Неверные идентификаторы" }, { status: 400 })
  }

  const existing = await getComment(postId, commentId)
  if (!existing) {
    return NextResponse.json({ message: "Комментарий не найден" }, { status: 404 })
  }

  if (existing.authorId !== userId) {
    return NextResponse.json(
      { message: "Можно удалять только свои комментарии" },
      { status: 403 }
    )
  }

  await prisma.newsPostComment.delete({
    where: { id: commentId },
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
