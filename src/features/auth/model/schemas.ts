import { z } from "zod"

export const loginSchema = z.object({
  email: z.email("РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ email"),
  password: z
    .string()
    .min(8, "РџР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РЅРµ РєРѕСЂРѕС‡Рµ 8 СЃРёРјРІРѕР»РѕРІ")
    .max(72, "РџР°СЂРѕР»СЊ СЃР»РёС€РєРѕРј РґР»РёРЅРЅС‹Р№"),
})

const phoneSchema = z
  .string()
  .trim()
  .min(8, "РўРµР»РµС„РѕРЅ СЃР»РёС€РєРѕРј РєРѕСЂРѕС‚РєРёР№")
  .max(20, "РўРµР»РµС„РѕРЅ СЃР»РёС€РєРѕРј РґР»РёРЅРЅС‹Р№")

export const recoveryPhoneSchema = z.object({
  phone: phoneSchema,
})

export const recoveryCodeSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Р’РІРµРґРёС‚Рµ РєРѕРґ РёР· 6 С†РёС„СЂ"),
})

export const registerSchema = z
  .object({
    email: z.email("РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ email"),
    password: z
      .string()
      .min(8, "РџР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РЅРµ РєРѕСЂРѕС‡Рµ 8 СЃРёРјРІРѕР»РѕРІ")
      .max(72, "РџР°СЂРѕР»СЊ СЃР»РёС€РєРѕРј РґР»РёРЅРЅС‹Р№"),
    confirmPassword: z.string().min(1, "РџРѕРґС‚РІРµСЂРґРёС‚Рµ РїР°СЂРѕР»СЊ"),
    firstName: z
      .string()
      .trim()
      .min(2, "РРјСЏ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РЅРµ РєРѕСЂРѕС‡Рµ 2 СЃРёРјРІРѕР»РѕРІ")
      .max(40, "РРјСЏ СЃР»РёС€РєРѕРј РґР»РёРЅРЅРѕРµ"),
    lastName: z
      .string()
      .trim()
      .max(40, "Р¤Р°РјРёР»РёСЏ СЃР»РёС€РєРѕРј РґР»РёРЅРЅР°СЏ")
      .optional()
      .or(z.literal("")),
    phone: z
      .string()
      .trim()
      .min(8, "РўРµР»РµС„РѕРЅ СЃР»РёС€РєРѕРј РєРѕСЂРѕС‚РєРёР№")
      .max(20, "РўРµР»РµС„РѕРЅ СЃР»РёС€РєРѕРј РґР»РёРЅРЅС‹Р№"),
    turnstileToken: z
      .string()
      .trim()
      .min(1, "РџРѕРґС‚РІРµСЂРґРёС‚Рµ, С‡С‚Рѕ РІС‹ РЅРµ Р±РѕС‚"),
    referrerId: z.coerce.number().int().positive().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "РџР°СЂРѕР»Рё РЅРµ СЃРѕРІРїР°РґР°СЋС‚",
    path: ["confirmPassword"],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type RecoveryPhoneInput = z.infer<typeof recoveryPhoneSchema>
export type RecoveryCodeInput = z.infer<typeof recoveryCodeSchema>

