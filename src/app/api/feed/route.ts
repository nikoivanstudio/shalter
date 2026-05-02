import { type NextRequest, NextResponse } from "next/server"

import { createNewsPostSchema } from "@/features/feed/model/schemas"
import { getAuthorizedUserIdFromRequest } from "@/shared/lib/auth/request-user"
import { prisma } from "@/shared/lib/db/prisma"
import type { MediaAttachment } from "@/shared/lib/media/constants"
import { saveMessageFile, validateMessageFile } from "@/shared/lib/media/uploads"

function isFileLike(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "size" in value &&
    typeof value.size === "number" &&
    "name" in value &&
    typeof value.name === "string" &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function"
  )
}

function isSupportedFeedMedia(file: File) {
  return file.type.startsWith("image/") || file.type.startsWith("video/")
}

function mapAttachmentFromPost(post: {
  mediaKind: string | null
  mediaUrl: string | null
  mediaName: string | null
  mediaMime: string | null
  mediaSize: number | null
}): MediaAttachment | null {
  if (!post.mediaKind || !post.mediaUrl || !post.mediaName || !post.mediaMime || post.mediaSize === null) {
    return null
  }

  return {
    kind: post.mediaKind as MediaAttachment["kind"],
    url: post.mediaUrl,
    name: post.mediaName,
    mime: post.mediaMime,
    size: post.mediaSize,
  }
}

export async function POST(request: NextRequest) {
  const userId = await getAuthorizedUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ message: "Не авторизован" }, { status: 401 })
  }

  const contentType = request.headers.get("content-type") ?? ""
  let parsedPayload: unknown = null
  let attachmentFile: File | null = null

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json({ message: "Некорректная форма" }, { status: 400 })
    }

    parsedPayload = {
      content: typeof formData.get("content") === "string" ? String(formData.get("content")) : "",
    }

    const attachmentValue = formData.get("attachment")
    attachmentFile = isFileLike(attachmentValue) && attachmentValue.size > 0 ? attachmentValue : null
  } else {
    parsedPayload = await request.json().catch(() => null)
  }

  const parsed = createNewsPostSchema.safeParse(parsedPayload)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Ошибка валидации",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  if (!parsed.data.content && !attachmentFile) {
    return NextResponse.json(
      {
        message: "Ошибка валидации",
        fieldErrors: {
          content: ["Добавьте текст или прикрепите файл"],
        },
      },
      { status: 400 }
    )
  }

  let attachment: Awaited<ReturnType<typeof saveMessageFile>> | null = null
  if (attachmentFile) {
    if (!isSupportedFeedMedia(attachmentFile)) {
      return NextResponse.json(
        {
          message: "Ошибка валидации",
          fieldErrors: {
            attachment: ["Можно прикреплять только изображения и видео"],
          },
        },
        { status: 400 }
      )
    }

    const validationError = validateMessageFile("FILE", attachmentFile)
    if (validationError) {
      return NextResponse.json(
        {
          message: "Ошибка валидации",
          fieldErrors: {
            attachment: [validationError],
          },
        },
        { status: 400 }
      )
    }

    attachment = await saveMessageFile("FILE", attachmentFile)
  }

  const post = await prisma.newsPost.create({
    data: {
      authorId: userId,
      content: parsed.data.content,
      mediaKind: attachment ? "FILE" : null,
      mediaUrl: attachment?.url ?? null,
      mediaName: attachment?.name ?? null,
      mediaMime: attachment?.mime ?? null,
      mediaSize: attachment?.size ?? null,
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
      post: {
        id: post.id,
        content: post.content,
        createdAt: post.createdAt.toISOString(),
        author: post.author,
        attachment: mapAttachmentFromPost(post),
        likesCount: 0,
        likedByMe: false,
        comments: [],
      },
    },
    { status: 201 }
  )
}
