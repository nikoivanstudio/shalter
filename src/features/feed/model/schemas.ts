import { z } from "zod"

export const createNewsPostSchema = z.object({
  content: z.string().trim().max(2000, "Текст публикации слишком длинный").default(""),
})

export const createNewsCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Введите текст комментария")
    .max(1000, "Комментарий слишком длинный"),
})

export type CreateNewsPostInput = z.infer<typeof createNewsPostSchema>
export type CreateNewsCommentInput = z.infer<typeof createNewsCommentSchema>
