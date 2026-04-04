import { z } from "zod"

export const createChatSchema = z.object({
  participantIds: z.array(z.number().int().positive()).min(1, "Выберите хотя бы один контакт"),
})

export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Сообщение не может быть пустым")
    .max(1000, "Сообщение слишком длинное"),
})

export type CreateChatInput = z.infer<typeof createChatSchema>
export type SendMessageInput = z.infer<typeof sendMessageSchema>
