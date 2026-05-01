import { z } from "zod"

import { loginSchema, registerSchema } from "@/features/auth/model/schemas"
import { publishBotSchema } from "@/features/bots/model/schemas"
import {
  createChatSchema,
  sendMessageSchema,
  updateDialogParticipantsSchema,
} from "@/features/chats/model/schemas"
import { getDialogDisplayTitle, getDialogUserName } from "@/features/chats/lib/dialog-title"
import { addContactSchema, blacklistUserSchema } from "@/features/contacts/model/schemas"
import { getAccountStatusLabel } from "@/features/profile/lib/account-status"
import { buildEmblem, getEmblemTone } from "@/features/profile/lib/emblem"
import { updateProfileSchema } from "@/features/profile/model/schemas"
import { cn } from "@/lib/utils"

describe("utils and schemas", () => {
  test("cn merges tailwind classes", () => {
    expect(cn("px-2", undefined, "px-4", "text-sm")).toBe("px-4 text-sm")
  })

  test("buildEmblem handles full, partial and empty names", () => {
    expect(buildEmblem("John", "Smith")).toBe("JS")
    expect(buildEmblem(" John ", null)).toBe("J")
    expect(buildEmblem(" ", null)).toBe("U")
  })

  test("getEmblemTone picks a stable color from initials", () => {
    expect(getEmblemTone("John", "Smith")).toBe(getEmblemTone(" John ", " Smith "))
    expect(getEmblemTone("John", "Smith")).not.toBe(getEmblemTone("Anna", "Stone"))
  })

  test("getAccountStatusLabel resolves user-facing statuses", () => {
    expect(getAccountStatusLabel({ role: "owner", email: "owner@example.com" })).toBe(
      "Владелец мессенджера"
    )
    expect(getAccountStatusLabel({ role: "admin", email: "admin@example.com" })).toBe(
      "Администратор"
    )
    expect(getAccountStatusLabel({ role: "user", email: "matveykanico@gmail.com" })).toBe(
      "Разработчик"
    )
    expect(getAccountStatusLabel({ role: "user", email: "user@example.com" })).toBe(
      "Пользователь"
    )
  })

  test("getDialogUserName and getDialogDisplayTitle resolve titles", () => {
    const users = [
      { id: 1, firstName: "Ivan", lastName: "Petrov" },
      { id: 2, firstName: "Anna", lastName: null },
      { id: 3, firstName: "Oleg", lastName: "Sidorov" },
    ]

    expect(getDialogUserName(users[0])).toBe("Ivan Petrov")
    expect(getDialogDisplayTitle({ title: null, users: users.slice(0, 2) }, 1)).toBe("Anna")
    expect(getDialogDisplayTitle({ title: "  Team  ", users }, 1)).toBe("Team")
    expect(getDialogDisplayTitle({ title: " ", users }, 1)).toBe("Ivan Petrov, Anna, Oleg Sidorov")
    expect(getDialogDisplayTitle({ title: null, users: [{ id: 1, firstName: "Solo", lastName: null }] }, 1)).toBe(
      "Без названия"
    )
  })

  test("auth schemas validate and reject invalid values", () => {
    expect(
      loginSchema.parse({
        email: "user@example.com",
        password: "password123",
      })
    ).toEqual({
      email: "user@example.com",
      password: "password123",
    })

    expect(() =>
      registerSchema.parse({
        email: "user@example.com",
        password: "password123",
        confirmPassword: "password321",
        firstName: "A",
        lastName: "B".repeat(41),
        phone: "123",
        inviteMessage: "",
      })
    ).toThrow(z.ZodError)
  })

  test("chat, contact and profile schemas validate edge cases", () => {
    expect(
      createChatSchema.parse({
        participantIds: [1, 2, 2],
        title: " test ",
      }).title
    ).toBe("test")

    expect(() => updateDialogParticipantsSchema.parse({ participantIds: [] })).toThrow(z.ZodError)
    expect(sendMessageSchema.parse({ content: " hello " }).content).toBe("hello")
    expect(() => sendMessageSchema.parse({ content: " " })).toThrow(z.ZodError)
    expect(addContactSchema.parse({ contactUserId: 1 }).contactUserId).toBe(1)
    expect(() => blacklistUserSchema.parse({ blockedUserId: 0 })).toThrow(z.ZodError)
    expect(
      updateProfileSchema.parse({
        email: "user@example.com",
        firstName: "Ivan",
        lastName: "",
        phone: "12345678",
        avatarTone: null,
      }).lastName
    ).toBe("")

    expect(
      publishBotSchema.parse({
        audience: "client",
        config: {
          name: "Support Bot",
          niche: "SaaS",
          goal: "Answer FAQs",
          tone: "Warm",
          greeting: "Hi!",
          knowledge: ["Billing"],
          channels: ["Shalter"],
          skills: ["Answer questions"],
          guardrails: ["No refunds without manager"],
          escalation: "Escalate payment disputes",
          flow: [{ type: "identity", title: "Start", value: "Support Bot|SaaS" }],
          handoffEnabled: true,
          analytics: {
            trackLeads: true,
            trackFallbacks: true,
            summaryWindow: "daily",
          },
        },
      }).audience
    ).toBe("client")
  })
})
