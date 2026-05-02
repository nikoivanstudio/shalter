import { z } from "zod"

export const adAudienceSchema = z.enum(["all", "client", "user"])
export const adStatusSchema = z.enum(["draft", "active", "paused"])

const normalizedTargetUrlSchema = z
  .string()
  .trim()
  .min(1, "Укажите ссылку")
  .transform((value) =>
    /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`
  )
  .pipe(z.string().url("Укажите корректную ссылку"))

const adBudgetSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      return Number(value.replace(/\s+/g, "").replace(",", "."))
    }

    return value
  },
  z
    .number()
    .int("Бюджет должен быть целым числом")
    .min(100, "Минимальный бюджет 100")
    .max(1_000_000, "Бюджет слишком большой")
)

export const createAdCampaignSchema = z.object({
  title: z.string().trim().min(3, "Укажите название рекламы").max(140, "Название слишком длинное"),
  description: z
    .string()
    .trim()
    .min(10, "Добавьте описание рекламы")
    .max(2000, "Описание слишком длинное"),
  ctaText: z
    .string()
    .trim()
    .min(2, "Добавьте призыв к действию")
    .max(60, "Призыв слишком длинный"),
  targetUrl: normalizedTargetUrlSchema,
  audience: adAudienceSchema,
  budget: adBudgetSchema,
})

export const updateAdCampaignSchema = z.object({
  status: adStatusSchema,
})

export type CreateAdCampaignInput = z.infer<typeof createAdCampaignSchema>
export type UpdateAdCampaignInput = z.infer<typeof updateAdCampaignSchema>
