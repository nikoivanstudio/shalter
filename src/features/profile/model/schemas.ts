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

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(8, "Текущий пароль должен быть не короче 8 символов")
      .max(72, "Текущий пароль слишком длинный"),
    newPassword: z
      .string()
      .min(8, "Новый пароль должен быть не короче 8 символов")
      .max(72, "Новый пароль слишком длинный"),
    confirmNewPassword: z.string().min(1, "Подтвердите новый пароль"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Пароли не совпадают",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Новый пароль должен отличаться от текущего",
    path: ["newPassword"],
  })

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
