"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { AccountStatusBadge } from "@/components/ui/account-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/features/i18n/model/i18n-provider"
import { LanguageToggle } from "@/features/i18n/ui/language-toggle"
import { Separator } from "@/components/ui/separator"
import { LogoutButton } from "@/features/auth/ui/logout-button"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { buildEmblem, EMBLEM_TONE_OPTIONS, getEmblemTone } from "@/features/profile/lib/emblem"
import {
  type ChangePasswordInput,
  type UpdateProfileInput,
  changePasswordSchema,
  updateProfileSchema,
} from "@/features/profile/model/schemas"
import { ThemeToggle } from "@/features/theme/ui/theme-toggle"

type EditableUser = {
  id: number
  email: string
  firstName: string
  lastName: string | null
  phone: string
  role: string
  avatarTone: UpdateProfileInput["avatarTone"]
}

type FieldErrors = Record<string, string[] | undefined>

function getFieldError(errors: FieldErrors, key: string) {
  return errors[key]?.[0]
}

export function ProfileHome({ user }: { user: EditableUser }) {
  const router = useRouter()
  const { tr } = useI18n()
  const [isPending, startTransition] = useTransition()
  const [isDeletingAccount, startDeletingAccount] = useTransition()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({})
  const [serverMessage, setServerMessage] = useState("")
  const [passwordMessage, setPasswordMessage] = useState("")
  const [form, setForm] = useState<UpdateProfileInput>({
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName ?? "",
    phone: user.phone,
    avatarTone: user.avatarTone,
  })
  const [passwordForm, setPasswordForm] = useState<ChangePasswordInput>({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  })
  const lastName = form.lastName ?? null
  const emblem = buildEmblem(form.firstName, lastName)
  const emblemTone = getEmblemTone(form.firstName, lastName, form.avatarTone)
  const displayName = `${form.firstName} ${lastName ?? ""}`.trim()

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
        setServerMessage(tr(data?.message ?? "Не удалось сохранить профиль"))
        return
      }

      setForm({
        email: data.user.email,
        firstName: data.user.firstName,
        lastName: data.user.lastName ?? "",
        phone: data.user.phone,
        avatarTone: data.user.avatarTone ?? null,
      })
      toast.success(tr("Профиль сохранён"))
    })
  }

  function updatePasswordField<K extends keyof ChangePasswordInput>(
    key: K,
    value: ChangePasswordInput[K]
  ) {
    setPasswordForm((prev) => ({ ...prev, [key]: value }))
  }

  function onChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPasswordMessage("")
    setPasswordErrors({})

    const parsed = changePasswordSchema.safeParse(passwordForm)
    if (!parsed.success) {
      setPasswordErrors(parsed.error.flatten().fieldErrors)
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setPasswordErrors((data?.fieldErrors ?? {}) as FieldErrors)
        setPasswordMessage(tr(data?.message ?? "Не удалось изменить пароль"))
        return
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      })
      toast.success(tr("Пароль изменён"))
    })
  }

  function deleteAccount() {
    const confirmed = window.confirm(
      tr("Удалить аккаунт без возможности восстановления? Вы будете автоматически разлогинены.")
    )

    if (!confirmed) {
      return
    }

    startDeletingAccount(async () => {
      const response = await fetch("/api/profile", {
        method: "DELETE",
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось удалить аккаунт"))
        return
      }

      toast.success(tr("Аккаунт удалён"))
      router.replace("/auth")
      router.refresh()
    })
  }

  return (
    <main className="min-h-screen px-4 py-5 pb-28 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <header className="rounded-[2rem] border border-white/50 bg-card/88 px-5 py-4 shadow-[0_20px_55px_-32px_rgba(15,23,42,0.48)] backdrop-blur-xl dark:border-white/8">
          <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-14 items-center justify-center rounded-full border border-white/55 text-sm font-semibold shadow-lg shadow-sky-500/10 ${emblemTone}`}
            >
              {emblem}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-lg font-semibold">{displayName || tr("Пользователь")}</p>
                <AccountStatusBadge
                  role={user.role}
                  email={form.email}
                  firstName={form.firstName}
                  lastName={lastName}
                />
              </div>
              <p className="truncate text-sm text-muted-foreground">{tr("Ваш профиль и безопасность")}</p>
            </div>
          </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
        </header>

        <Card className="border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
          <CardHeader className="border-b border-border/55 pb-5">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {tr("Настройки профиля")}
            </CardTitle>
            <CardDescription>
              {tr("Изменения сохраняются в базе данных без смены пароля.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <form className="space-y-5" onSubmit={onSaveProfile}>
              <div className="space-y-2">
                <Label htmlFor="profile-first-name">{tr("Имя")}</Label>
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
                <Label htmlFor="profile-last-name">{tr("Фамилия (необязательно)")}</Label>
                <Input
                  id="profile-last-name"
                  value={form.lastName ?? ""}
                  onChange={(e) => updateField("lastName", e.target.value)}
                  autoComplete="family-name"
                  placeholder={tr("Можно оставить пустым")}
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
                <Label htmlFor="profile-phone">{tr("Телефон")}</Label>
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

              <div className="space-y-2">
                <Label>{tr("Цвет аватарки")}</Label>
                <div className="flex flex-wrap gap-2">
                  {EMBLEM_TONE_OPTIONS.map((tone) => {
                    const active = form.avatarTone === tone.id

                    return (
                      <button
                        key={tone.id}
                        type="button"
                        className={`flex size-10 items-center justify-center rounded-full border-2 transition-transform hover:scale-105 ${tone.className} ${active ? "border-foreground/70" : "border-transparent"}`}
                        onClick={() => updateField("avatarTone", tone.id)}
                        aria-label={tr("Выберите цвет аватарки")}
                        title={tr("Выберите цвет аватарки")}
                      >
                        {active ? emblem : ""}
                      </button>
                    )
                  })}
                </div>
              </div>

              {serverMessage && (
                <>
                  <Separator />
                  <p className="text-sm text-destructive">{serverMessage}</p>
                </>
              )}

              <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
                {isPending ? tr("Сохраняем...") : tr("Сохранить профиль")}
              </Button>
            </form>

            <Separator />

            <form className="space-y-5" onSubmit={onChangePassword}>
              <div>
                <p className="text-sm font-medium">{tr("Изменение пароля")}</p>
                <p className="text-sm text-muted-foreground">
                  {tr("Укажите текущий пароль и дважды введите новый.")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-current-password">{tr("Текущий пароль")}</Label>
                <Input
                  id="profile-current-password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => updatePasswordField("currentPassword", e.target.value)}
                  autoComplete="current-password"
                />
                {getFieldError(passwordErrors, "currentPassword") && (
                  <p className="text-sm text-destructive">
                    {getFieldError(passwordErrors, "currentPassword")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-new-password">{tr("Новый пароль")}</Label>
                <Input
                  id="profile-new-password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => updatePasswordField("newPassword", e.target.value)}
                  autoComplete="new-password"
                />
                {getFieldError(passwordErrors, "newPassword") && (
                  <p className="text-sm text-destructive">
                    {getFieldError(passwordErrors, "newPassword")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-confirm-new-password">
                  {tr("Подтверждение нового пароля")}
                </Label>
                <Input
                  id="profile-confirm-new-password"
                  type="password"
                  value={passwordForm.confirmNewPassword}
                  onChange={(e) => updatePasswordField("confirmNewPassword", e.target.value)}
                  autoComplete="new-password"
                />
                {getFieldError(passwordErrors, "confirmNewPassword") && (
                  <p className="text-sm text-destructive">
                    {getFieldError(passwordErrors, "confirmNewPassword")}
                  </p>
                )}
              </div>

              {passwordMessage && <p className="text-sm text-destructive">{passwordMessage}</p>}

              <Button type="submit" variant="outline" className="w-full sm:w-auto" disabled={isPending}>
                {isPending ? tr("Изменяем пароль...") : tr("Изменить пароль")}
              </Button>
            </form>

            <Separator />

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-destructive">{tr("Удаление аккаунта")}</p>
                <p className="text-sm text-muted-foreground">
                  {tr(
                    "Аккаунт, ваши сообщения и доступ к приложению будут удалены без возможности восстановления."
                  )}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={isDeletingAccount}
                onClick={deleteAccount}
              >
                {isDeletingAccount ? tr("Удаляем аккаунт...") : tr("Удалить аккаунт")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <BottomNav active="settings" />
    </main>
  )
}
