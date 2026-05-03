import { z } from "zod"

export const createChannelSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Название канала должно быть не короче 2 символов")
    .max(80, "Название канала слишком длинное"),
  description: z
    .string()
    .trim()
    .max(280, "Описание канала слишком длинное")
    .optional()
    .or(z.literal("")),
})

export const updateChannelSchema = createChannelSchema

export const addChannelParticipantsSchema = z.object({
  participantIds: z
    .array(z.number().int().positive())
    .min(1, "Выберите хотя бы одного пользователя"),
})

export const updateChannelParticipantRoleSchema = z.object({
  targetUserId: z.number().int().positive(),
  role: z.enum(["ADMIN", "MEMBER"]),
})

export const sendChannelMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Сообщение не может быть пустым")
    .max(1000, "Сообщение слишком длинное"),
})

export type CreateChannelInput = z.infer<typeof createChannelSchema>
