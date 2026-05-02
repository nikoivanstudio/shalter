import { z } from "zod"

const botFlowItemSchema = z.object({
  type: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(120),
  value: z.string().max(4000),
})

export const botAudienceSchema = z.enum(["client", "user"])

export const publishBotSchema = z.object({
  audience: botAudienceSchema,
  config: z.object({
    name: z.string().trim().min(2, "Укажите имя бота").max(120, "Имя бота слишком длинное"),
    niche: z.string().trim().max(120, "Ниша слишком длинная"),
    goal: z.string().trim().min(1, "Укажите цель бота").max(2000, "Цель слишком длинная"),
    tone: z.string().trim().max(500, "Описание стиля слишком длинное"),
    greeting: z
      .string()
      .trim()
      .min(1, "Добавьте первое сообщение")
      .max(2000, "Приветствие слишком длинное"),
    knowledge: z.array(z.string().trim().min(1).max(200)).max(50),
    channels: z.array(z.string().trim().min(1).max(80)).min(1, "Добавьте хотя бы один канал").max(20),
    skills: z.array(z.string().trim().min(1).max(200)).max(50),
    guardrails: z.array(z.string().trim().min(1).max(200)).max(50),
    escalation: z.string().trim().max(2000, "Правило передачи слишком длинное"),
    flow: z.array(botFlowItemSchema).min(1, "Сценарий пуст").max(100),
    handoffEnabled: z.boolean(),
    analytics: z.object({
      trackLeads: z.boolean(),
      trackFallbacks: z.boolean(),
      summaryWindow: z.string().trim().min(1).max(40),
    }),
  }),
})

export type PublishBotInput = z.infer<typeof publishBotSchema>
