import { z } from "zod"

export const addContactSchema = z.object({
  contactUserId: z.int().positive("Некорректный идентификатор пользователя"),
})

export const blacklistUserSchema = z.object({
  blockedUserId: z.int().positive("Некорректный идентификатор пользователя"),
})
