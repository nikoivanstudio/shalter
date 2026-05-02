import { z } from "zod"

export const adAudienceSchema = z.enum(["all", "client", "user"])
export const adStatusSchema = z.enum(["draft", "active", "paused"])

export const createAdCampaignSchema = z.object({
  title: z.string().trim().min(3, "Укажите название рекламы").max(140, "Название слишком длинное"),
  description: z
    .string()
    .trim()
    .min(10, "Добавьте описание рекламы")
    .max(2000, "Описание слишком длинное"),
  ctaText: z.string().trim().min(2, "Добавьте призыв к действию").max(60, "Призыв слишком длинный"),
  targetUrl: z.url("Укажите корректную ссылку"),
  audience: adAudienceSchema,
  budget: z
    .number({ error: "Укажите бюджет" })
    .int("Бюджет должен быть целым числом")
    .min(100, "Минимальный бюджет 100")
    .max(1_000_000, "Бюджет слишком большой"),
})

export const updateAdCampaignSchema = z.object({
  status: adStatusSchema,
})

export type CreateAdCampaignInput = z.infer<typeof createAdCampaignSchema>
export type UpdateAdCampaignInput = z.infer<typeof updateAdCampaignSchema>
