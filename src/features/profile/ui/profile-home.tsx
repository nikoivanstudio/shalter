"use client"

import { MessageCircleIcon, SettingsIcon, UsersIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { LogoutButton } from "@/features/auth/ui/logout-button"
import {
  type UpdateProfileInput,
  updateProfileSchema,
} from "@/features/profile/model/schemas"
import { ThemeToggle } from "@/features/theme/ui/theme-toggle"

type EditableUser = {
  id: number
  email: string
  firstName: string
  lastName: string | null
  phone: string
}

type FieldErrors = Record<string, string[] | undefined>
type ActiveSection = "settings" | "contacts" | "chats"

function getFieldError(errors: FieldErrors, key: string) {
  return errors[key]?.[0]
}

function buildEmblem(firstName: string, lastName: string | null) {
  const first = firstName.trim().charAt(0).toUpperCase()
  const last = (lastName ?? "").trim().charAt(0).toUpperCase()

  if (first && last) {
    return `${first}${last}`
  }

  if (first) {
    return first
  }

  return "U"
}

export function ProfileHome({ user }: { user: EditableUser }) {
  const [isPending, startTransition] = useTransition()
  const [activeSection, setActiveSection] = useState<ActiveSection>("settings")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverMessage, setServerMessage] = useState("")
  const [form, setForm] = useState<UpdateProfileInput>({
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName ?? "",
    phone: user.phone,
  })
  const [emblem, setEmblem] = useState(buildEmblem(user.firstName, user.lastName))

  function updateField<K extends keyof UpdateProfileInput>(key: K, value: UpdateProfileInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerMessage("")
    setFieldErrors({})

    const parsed = updateProfileSchema.safeParse(form)
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors)
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setFieldErrors((data?.fieldErrors ?? {}) as FieldErrors)
        setServerMessage(data?.message ?? "Не удалось сохранить профиль")
        return
      }

      setForm({
        email: data.user.email,
        firstName: data.user.firstName,
        lastName: data.user.lastName ?? "",
        phone: data.user.phone,
      })
      setEmblem(buildEmblem(data.user.firstName, data.user.lastName))
      toast.success("Профиль сохранён")
    })
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6 pb-28">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full border border-border/80 bg-card text-sm font-semibold shadow-sm">
              {emblem}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{form.firstName} {form.lastName}</p>
              <p className="truncate text-sm text-muted-foreground">{form.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>

        <Card className="border-border/80 shadow-xl shadow-black/5">
          <CardHeader>
            <CardTitle className="text-2xl">Личный кабинет</CardTitle>
            <CardDescription>
              Управляйте своим профилем и разделами приложения.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeSection === "settings" && (
              <form className="space-y-4" onSubmit={onSaveProfile}>
                <div className="space-y-2">
                  <Label htmlFor="profile-first-name">Имя</Label>
                  <Input
                    id="profile-first-name"
                    value={form.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    autoComplete="given-name"
                  />
                  {getFieldError(fieldErrors, "firstName") && (
                    <p className="text-sm text-destructive">{getFieldError(fieldErrors, "firstName")}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-last-name">Фамилия</Label>
                  <Input
                    id="profile-last-name"
                    value={form.lastName ?? ""}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    autoComplete="family-name"
                  />
                  {getFieldError(fieldErrors, "lastName") && (
                    <p className="text-sm text-destructive">{getFieldError(fieldErrors, "lastName")}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-email">Email</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    autoComplete="email"
                  />
                  {getFieldError(fieldErrors, "email") && (
                    <p className="text-sm text-destructive">{getFieldError(fieldErrors, "email")}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-phone">Телефон</Label>
                  <Input
                    id="profile-phone"
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    autoComplete="tel"
                  />
                  {getFieldError(fieldErrors, "phone") && (
                    <p className="text-sm text-destructive">{getFieldError(fieldErrors, "phone")}</p>
                  )}
                </div>

                {serverMessage && (
                  <>
                    <Separator />
                    <p className="text-sm text-destructive">{serverMessage}</p>
                  </>
                )}

                <Button type="submit" disabled={isPending}>
                  {isPending ? "Сохраняем..." : "Сохранить профиль"}
                </Button>
              </form>
            )}

            {activeSection === "contacts" && (
              <p className="text-sm text-muted-foreground">Раздел контактов в разработке.</p>
            )}

            {activeSection === "chats" && (
              <p className="text-sm text-muted-foreground">Раздел чатов в разработке.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-around px-4 py-3">
          <Button
            variant={activeSection === "settings" ? "default" : "ghost"}
            className="h-auto flex-col gap-1 px-4 py-2"
            onClick={() => setActiveSection("settings")}
          >
            <SettingsIcon className="size-4" />
            <span className="text-xs">Настройки</span>
          </Button>
          <Button
            variant={activeSection === "contacts" ? "default" : "ghost"}
            className="h-auto flex-col gap-1 px-4 py-2"
            onClick={() => setActiveSection("contacts")}
          >
            <UsersIcon className="size-4" />
            <span className="text-xs">Контакты</span>
          </Button>
          <Button
            variant={activeSection === "chats" ? "default" : "ghost"}
            className="h-auto flex-col gap-1 px-4 py-2"
            onClick={() => setActiveSection("chats")}
          >
            <MessageCircleIcon className="size-4" />
            <span className="text-xs">Чаты</span>
          </Button>
        </div>
      </nav>
    </main>
  )
}
