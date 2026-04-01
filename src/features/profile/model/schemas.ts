import { z } from "zod"

export const updateProfileSchema = z.object({
  email: z.email("Укажите корректный email"),
  firstName: z
    .string()
    .trim()
    .min(2, "Имя должно быть не короче 2 символов")
    .max(40, "Имя слишком длинное"),
  lastName: z
    .string()
    .trim()
    .max(40, "Фамилия слишком длинная")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .min(8, "Телефон слишком короткий")
    .max(20, "Телефон слишком длинный"),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
