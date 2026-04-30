import { z } from "zod"

import { DEFAULT_MEDIA_LABELS, MEDIA_KIND_VALUES, type MediaKind } from "./constants"

const contentSchema = z
  .string()
  .trim()
  .max(1000, "Сообщение слишком длинное")

export type ParsedMessageInput = {
  content: string
  attachment: {
    kind: MediaKind
    file: File
  } | null
}

export async function parseMessageInput(
  request: Request
): Promise<
  | { success: true; data: ParsedMessageInput }
  | {
      success: false
      fieldErrors: Record<string, string[] | undefined>
    }
> {
  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null)

    if (!formData) {
      return { success: false, fieldErrors: { content: ["Некорректная форма"] } }
    }

    const rawContent = typeof formData.get("content") === "string" ? String(formData.get("content")) : ""
    const parsedContent = contentSchema.safeParse(rawContent)
    if (!parsedContent.success) {
      return {
        success: false,
        fieldErrors: {
          content: parsedContent.error.issues.map((issue) => issue.message),
        },
      }
    }

    const kindValue = formData.get("kind")
    const attachment = formData.get("attachment")
    const hasFile = attachment instanceof File && attachment.size > 0

    if (!hasFile) {
      if (!parsedContent.data) {
        return { success: false, fieldErrors: { content: ["Введите сообщение"] } }
      }

      return {
        success: true,
        data: {
          content: parsedContent.data,
          attachment: null,
        },
      }
    }

    const parsedKind = z.enum(MEDIA_KIND_VALUES).safeParse(kindValue)
    if (!parsedKind.success) {
      return { success: false, fieldErrors: { attachment: ["Неизвестный тип вложения"] } }
    }

    return {
      success: true,
      data: {
        content: parsedContent.data || DEFAULT_MEDIA_LABELS[parsedKind.data],
        attachment: {
          kind: parsedKind.data,
          file: attachment,
        },
      },
    }
  }

  const json = await request.json().catch(() => null)
  const parsed = z
    .object({
      content: contentSchema.min(1, "Введите сообщение"),
    })
    .safeParse(json)

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  return {
    success: true,
    data: {
      content: parsed.data.content,
      attachment: null,
    },
  }
}
