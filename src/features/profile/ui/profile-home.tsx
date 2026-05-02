"use client"

import { CameraIcon, GemIcon, HandCoinsIcon, RocketIcon, StarIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { AccountStatusBadge } from "@/components/ui/account-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { LogoutButton } from "@/features/auth/ui/logout-button"
import { useI18n } from "@/features/i18n/model/i18n-provider"
import { LanguageToggle } from "@/features/i18n/ui/language-toggle"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { EMBLEM_TONE_OPTIONS } from "@/features/profile/lib/emblem"
import {
  type ChangePasswordInput,
  type UpdateProfileInput,
  changePasswordSchema,
  updateProfileSchema,
} from "@/features/profile/model/schemas"
import { ThemeToggle } from "@/features/theme/ui/theme-toggle"
import { normalizeRole, PREMIUM_ROLE } from "@/shared/lib/auth/roles"
import {
  giftCatalog,
  hasInfiniteStars,
  PARTNER_REWARD_STARS,
  type GiftKey,
} from "@/shared/lib/rewards/catalog"
import { UserAvatar } from "@/shared/ui/user-avatar"

type EditableUser = {
  id: number
  email: string
  firstName: string
  lastName: string | null
  phone: string
  role: string
  starsBalance?: number
  partnerStarsEarned?: number
  avatarTone?: UpdateProfileInput["avatarTone"]
  avatarUrl?: string | null
}

type FieldErrors = Record<string, string[] | undefined>

function getFieldError(errors: FieldErrors, key: string) {
  return errors[key]?.[0]
}

const FIRST_NAME_MIN_MESSAGE = "РРјСЏ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РЅРµ РєРѕСЂРѕС‡Рµ 2 СЃРёРјРІРѕР»РѕРІ"

export function ProfileHome({ user }: { user: EditableUser }) {
  const router = useRouter()
  const { tr } = useI18n()
  const [isPending, startTransition] = useTransition()
  const [isDeletingAccount, startDeletingAccount] = useTransition()
  const [isRewardPending, startRewardTransition] = useTransition()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({})
  const [serverMessage, setServerMessage] = useState("")
  const [passwordMessage, setPasswordMessage] = useState("")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(user.avatarUrl ?? null)
  const [form, setForm] = useState<UpdateProfileInput>({
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName ?? "",
    phone: user.phone ?? "",
    avatarTone: user.avatarTone ?? null,
  })
  const [passwordForm, setPasswordForm] = useState<ChangePasswordInput>({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  })
  const [starsBalance, setStarsBalance] = useState(user.starsBalance ?? 0)
  const [giftRecipientEmail, setGiftRecipientEmail] = useState("")
  const [giftNote, setGiftNote] = useState("")
  const [giftKey, setGiftKey] = useState<GiftKey>(giftCatalog[0]?.key ?? "coffee")
  const [starRecipientEmail, setStarRecipientEmail] = useState("")
  const [starAmount, setStarAmount] = useState("25")

  const lastName = form.lastName ?? null
  const displayName = `${form.firstName} ${lastName ?? ""}`.trim()
  const isPremium = normalizeRole(user.role) === PREMIUM_ROLE
  const isAdminWithInfiniteStars = hasInfiniteStars(user.role)
  const partnerLink = `https://shalter.ru/auth?ref=${user.id}`
  const selectedGift = giftCatalog.find((gift) => gift.key === giftKey) ?? giftCatalog[0]

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreviewUrl)
      }
    }
  }, [avatarPreviewUrl])

  function updateField<K extends keyof UpdateProfileInput>(key: K, value: UpdateProfileInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))

    if (key === "firstName" && typeof value === "string") {
      const nextValue = value.trim()
      setFieldErrors((prev) => ({
        ...prev,
        firstName:
          nextValue.length === 0 || nextValue.length >= 2
            ? undefined
            : [FIRST_NAME_MIN_MESSAGE],
      }))
    }
  }

  function onAvatarChange(file: File | null) {
    setAvatarFile(file)

    setAvatarPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev)
      }
      return prev
    })

    if (!file) {
      setAvatarPreviewUrl(user.avatarUrl ?? null)
      return
    }

    setAvatarPreviewUrl(URL.createObjectURL(file))
  }

  function onSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerMessage("")
    setFieldErrors({})

    if (form.firstName.trim().length < 2) {
      setFieldErrors({
        firstName: [FIRST_NAME_MIN_MESSAGE],
      })
      return
    }

    const parsed = updateProfileSchema.safeParse(form)
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors)
      return
    }

    startTransition(async () => {
      const body =
        avatarFile === null
          ? JSON.stringify(parsed.data)
          : (() => {
              const formData = new FormData()
              formData.set("profile", JSON.stringify(parsed.data))
              formData.set("avatarFile", avatarFile)
              return formData
            })()

      const response = await fetch("/api/profile", {
        method: "PATCH",
        ...(body instanceof FormData
          ? { body }
          : {
              headers: { "Content-Type": "application/json" },
              body,
            }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setFieldErrors((data?.fieldErrors ?? {}) as FieldErrors)
        setServerMessage(tr(data?.message ?? "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС„РёР»СЊ"))
        return
      }

      setForm({
        email: data.user.email,
        firstName: data.user.firstName,
        lastName: data.user.lastName ?? "",
        phone: data.user.phone ?? "",
        avatarTone: data.user.avatarTone ?? null,
      })
      setAvatarFile(null)
      setAvatarPreviewUrl(data.user.avatarUrl ?? null)
      toast.success(tr("РџСЂРѕС„РёР»СЊ СЃРѕС…СЂР°РЅС‘РЅ"))
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
        setPasswordMessage(tr(data?.message ?? "РќРµ СѓРґР°Р»РѕСЃСЊ РёР·РјРµРЅРёС‚СЊ РїР°СЂРѕР»СЊ"))
        return
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      })
      toast.success(tr("РџР°СЂРѕР»СЊ РёР·РјРµРЅС‘РЅ"))
    })
  }

  function deleteAccount() {
    const confirmed = window.confirm(
      tr("РЈРґР°Р»РёС‚СЊ Р°РєРєР°СѓРЅС‚ Р±РµР· РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ? Р’С‹ Р±СѓРґРµС‚Рµ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЂР°Р·Р»РѕРіРёРЅРµРЅС‹.")
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
        toast.error(tr(data?.message ?? "РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ Р°РєРєР°СѓРЅС‚"))
        return
      }

      toast.success(tr("РђРєРєР°СѓРЅС‚ СѓРґР°Р»С‘РЅ"))
      router.replace("/auth")
      router.refresh()
    })
  }

  async function handlePartnerProgramAction() {
    const shareText = "РџСЂРёСЃРѕРµРґРёРЅСЏР№С‚РµСЃСЊ Рє Shalter РїРѕ РјРѕРµР№ РїР°СЂС‚РЅС‘СЂСЃРєРѕР№ СЃСЃС‹Р»РєРµ."

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: "Shalter",
          text: shareText,
          url: partnerLink,
        })
        toast.success("РџР°СЂС‚РЅС‘СЂСЃРєР°СЏ СЃСЃС‹Р»РєР° РіРѕС‚РѕРІР° Рє РѕС‚РїСЂР°РІРєРµ")
        return
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(partnerLink)
        toast.success("РџР°СЂС‚РЅС‘СЂСЃРєР°СЏ СЃСЃС‹Р»РєР° СЃРєРѕРїРёСЂРѕРІР°РЅР°")
        return
      }

      window.prompt("РЎРєРѕРїРёСЂСѓР№С‚Рµ РїР°СЂС‚РЅС‘СЂСЃРєСѓСЋ СЃСЃС‹Р»РєСѓ", partnerLink)
    } catch {
      toast.error("РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРґРµР»РёС‚СЊСЃСЏ РїР°СЂС‚РЅС‘СЂСЃРєРѕР№ СЃСЃС‹Р»РєРѕР№")
    }
  }

  function sendGift() {
    if (!giftRecipientEmail.trim()) {
      toast.error("Укажите email получателя подарка")
      return
    }

    startRewardTransition(async () => {
      const response = await fetch("/api/rewards/gifts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientEmail: giftRecipientEmail,
          giftKey,
          note: giftNote,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось отправить подарок")
        return
      }

      if (!data.sender?.infiniteStars && typeof data.sender?.starsBalance === "number") {
        setStarsBalance(data.sender.starsBalance)
      }

      setGiftRecipientEmail("")
      setGiftNote("")
      toast.success("Подарок отправлен")
    })
  }

  function sendStars() {
    if (!starRecipientEmail.trim()) {
      toast.error("Укажите email получателя звёзд")
      return
    }

    const amount = Number(starAmount)
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("Укажите корректное количество звёзд")
      return
    }

    startRewardTransition(async () => {
      const response = await fetch("/api/rewards/stars", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientEmail: starRecipientEmail,
          amount,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось подарить звёзды")
        return
      }

      if (!data.sender?.infiniteStars && typeof data.sender?.starsBalance === "number") {
        setStarsBalance(data.sender.starsBalance)
      }

      setStarRecipientEmail("")
      toast.success("Звёзды отправлены")
    })
  }

  return (
    <main className="min-h-screen px-4 py-5 pb-28 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Card className="overflow-hidden border-border/70 bg-linear-to-br from-background via-background to-muted/25">
          <CardContent className="px-5 pt-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <UserAvatar
                    firstName={form.firstName}
                    lastName={lastName}
                    avatarTone={form.avatarTone}
                    avatarUrl={avatarPreviewUrl}
                    className="size-20 border border-border/70"
                    textClassName="text-xl font-semibold"
                  />
                  <label className="absolute -bottom-1 -right-1 cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="sr-only"
                      onChange={(event) => onAvatarChange(event.target.files?.[0] ?? null)}
                    />
                    <span className="flex size-9 items-center justify-center rounded-full border border-border/70 bg-background text-foreground shadow-sm">
                      <CameraIcon className="size-4" />
                    </span>
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-semibold">{displayName || user.email}</h1>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AccountStatusBadge
                      role={user.role}
                      email={user.email}
                      firstName={user.firstName}
                      lastName={user.lastName}
                    />
                    {isPremium ? (
                      <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        Premium
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {tr("РќР°СЃС‚СЂРѕР№РєРё РїСЂРѕС„РёР»СЏ")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start">
                <LanguageToggle />
                <ThemeToggle />
                <LogoutButton />
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <StatPill
                label="Звёзды"
                value={isAdminWithInfiniteStars ? "∞" : String(starsBalance)}
              />
              <StatPill
                label="Партнёрские награды"
                value={String(user.partnerStarsEarned ?? 0)}
              />
              <StatPill
                label="Бонус за приглашение"
                value={`${PARTNER_REWARD_STARS}`}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>{tr("РќР°СЃС‚СЂРѕР№РєРё РїСЂРѕС„РёР»СЏ")}</CardTitle>
                <CardDescription>
                  {tr("РР·РјРµРЅРµРЅРёСЏ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РІ Р±Р°Р·Рµ РґР°РЅРЅС‹С… Р±РµР· СЃРјРµРЅС‹ РїР°СЂРѕР»СЏ.")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={onSaveProfile}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label={tr("РРјСЏ")}
                      htmlFor="profile-first-name"
                      error={getFieldError(fieldErrors, "firstName")}
                      hint="Минимум 2 символа"
                    >
                      <Input
                        id="profile-first-name"
                        value={form.firstName}
                        onChange={(event) => updateField("firstName", event.target.value)}
                        aria-invalid={Boolean(getFieldError(fieldErrors, "firstName"))}
                      />
                    </Field>

                    <Field
                      label={tr("Р¤Р°РјРёР»РёСЏ (РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ)")}
                      htmlFor="profile-last-name"
                      error={getFieldError(fieldErrors, "lastName")}
                    >
                      <Input
                        id="profile-last-name"
                        value={form.lastName ?? ""}
                        onChange={(event) => updateField("lastName", event.target.value)}
                        aria-invalid={Boolean(getFieldError(fieldErrors, "lastName"))}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Email" htmlFor="profile-email" error={getFieldError(fieldErrors, "email")}>
                      <Input
                        id="profile-email"
                        type="email"
                        value={form.email}
                        onChange={(event) => updateField("email", event.target.value)}
                        aria-invalid={Boolean(getFieldError(fieldErrors, "email"))}
                      />
                    </Field>

                    <Field
                      label={tr("РўРµР»РµС„РѕРЅ")}
                      htmlFor="profile-phone"
                      error={getFieldError(fieldErrors, "phone")}
                    >
                      <Input
                        id="profile-phone"
                        value={form.phone}
                        onChange={(event) => updateField("phone", event.target.value)}
                        aria-invalid={Boolean(getFieldError(fieldErrors, "phone"))}
                      />
                    </Field>
                  </div>

                  <div className="space-y-3">
                    <Label>{tr("Р¦РІРµС‚ Р°РІР°С‚Р°СЂРєРё")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {EMBLEM_TONE_OPTIONS.map((tone) => {
                        const isActive = form.avatarTone === tone.id

                        return (
                          <button
                            key={tone.id}
                            type="button"
                            className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                              isActive
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/70 bg-background hover:bg-muted/60"
                            }`}
                            onClick={() => updateField("avatarTone", tone.id)}
                          >
                            <span className={`size-4 rounded-full border ${tone.className}`} />
                            <span className="capitalize">{tone.id}</span>
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        className="flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-2 text-sm hover:bg-muted/60"
                        onClick={() => updateField("avatarTone", null)}
                      >
                        <XIcon className="size-4" />
                        Сбросить
                      </button>
                    </div>
                    {avatarPreviewUrl ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => onAvatarChange(null)}>
                        <XIcon className="size-4" />
                        Убрать фото
                      </Button>
                    ) : null}
                    {getFieldError(fieldErrors, "avatarFile") ? (
                      <p className="text-sm text-destructive">{getFieldError(fieldErrors, "avatarFile")}</p>
                    ) : null}
                  </div>

                  {serverMessage ? <p className="text-sm text-destructive">{serverMessage}</p> : null}

                  <Button type="submit" disabled={isPending}>
                    {tr("РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС„РёР»СЊ")}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{tr("РР·РјРµРЅРµРЅРёРµ РїР°СЂРѕР»СЏ")}</CardTitle>
                <CardDescription>
                  {tr("РЈРєР°Р¶РёС‚Рµ С‚РµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ Рё РґРІР°Р¶РґС‹ РІРІРµРґРёС‚Рµ РЅРѕРІС‹Р№.")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={onChangePassword}>
                    <Field
                      label={tr("РўРµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ")}
                      htmlFor="current-password"
                      error={getFieldError(passwordErrors, "currentPassword")}
                    >
                      <Input
                        id="current-password"
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(event) =>
                        updatePasswordField("currentPassword", event.target.value)
                      }
                      aria-invalid={Boolean(getFieldError(passwordErrors, "currentPassword"))}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label={tr("РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ")}
                      htmlFor="new-password"
                      error={getFieldError(passwordErrors, "newPassword")}
                    >
                      <Input
                        id="new-password"
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(event) => updatePasswordField("newPassword", event.target.value)}
                        aria-invalid={Boolean(getFieldError(passwordErrors, "newPassword"))}
                      />
                    </Field>

                    <Field
                      label={tr("РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РЅРѕРІРѕРіРѕ РїР°СЂРѕР»СЏ")}
                      htmlFor="confirm-new-password"
                      error={getFieldError(passwordErrors, "confirmNewPassword")}
                    >
                      <Input
                        id="confirm-new-password"
                        type="password"
                        value={passwordForm.confirmNewPassword}
                        onChange={(event) =>
                          updatePasswordField("confirmNewPassword", event.target.value)
                        }
                        aria-invalid={Boolean(getFieldError(passwordErrors, "confirmNewPassword"))}
                      />
                    </Field>
                  </div>

                  {passwordMessage ? <p className="text-sm text-destructive">{passwordMessage}</p> : null}

                  <Button type="submit" disabled={isPending}>
                    {tr("РР·РјРµРЅРёС‚СЊ РїР°СЂРѕР»СЊ")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Партнёрская программа</CardTitle>
                <CardDescription>
                  Делитесь личной ссылкой и получайте бонус за каждого нового участника.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Ваша ссылка
                  </p>
                  <p className="mt-2 break-all text-sm">{partnerLink}</p>
                </div>
                <Button type="button" onClick={handlePartnerProgramAction}>
                  <RocketIcon className="size-4" />
                  РЎРєРѕРїРёСЂРѕРІР°С‚СЊ СЃСЃС‹Р»РєСѓ
                </Button>
              </CardContent>
            </Card>

            <PromoCard
              icon={<GemIcon className="size-5" />}
              title="Подарок за звёзды"
              badge={isAdminWithInfiniteStars ? "∞ баланс" : `${starsBalance} звёзд`}
              badgeTone="bg-primary/10 text-primary"
              description="Отправьте готовый подарок другому пользователю и приложите короткую заметку."
              bullets={[
                "Получатель увидит подарок сразу в своём профиле.",
                "Стоимость списывается только после успешной отправки.",
              ]}
              actionLabel={isRewardPending ? "Отправляем..." : "Отправить подарок"}
              actionVariant="default"
              footer="Поддержка команды, поздравления и быстрые знаки внимания."
              onAction={sendGift}
              details={
                <div className="space-y-3">
                  <Label htmlFor="giftRecipientEmail">Email получателя подарка</Label>
                  <Input
                    id="giftRecipientEmail"
                    type="email"
                    value={giftRecipientEmail}
                    onChange={(event) => setGiftRecipientEmail(event.target.value)}
                  />
                  <Label htmlFor="giftKey">Подарок</Label>
                  <select
                    id="giftKey"
                    className="h-11 w-full rounded-[1.1rem] border border-input bg-input/85 px-4 text-sm"
                    value={giftKey}
                    onChange={(event) => setGiftKey(event.target.value as GiftKey)}
                  >
                    {giftCatalog.map((gift) => (
                      <option key={gift.key} value={gift.key}>
                        {gift.name} - {gift.cost}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-muted-foreground">{selectedGift?.description}</p>
                  <Label htmlFor="giftNote">Комментарий</Label>
                  <Input
                    id="giftNote"
                    value={giftNote}
                    onChange={(event) => setGiftNote(event.target.value)}
                  />
                </div>
              }
            />

            <PromoCard
              icon={<HandCoinsIcon className="size-5" />}
              title="Перевод звёзд"
              badge={isAdminWithInfiniteStars ? "без лимита" : "моментально"}
              badgeTone="bg-amber-100 text-amber-800"
              description="Передайте звёзды напрямую пользователю по email."
              bullets={[
                "Подходит для быстрых поощрений внутри команды.",
                "Сумма списывается с текущего баланса.",
              ]}
              actionLabel={isRewardPending ? "Отправляем..." : "Подарить звёзды"}
              actionVariant="secondary"
              footer="Баланс обновляется после успешного перевода."
              onAction={sendStars}
              details={
                <div className="space-y-3">
                  <Label htmlFor="starRecipientEmail">Email получателя звёзд</Label>
                  <Input
                    id="starRecipientEmail"
                    type="email"
                    value={starRecipientEmail}
                    onChange={(event) => setStarRecipientEmail(event.target.value)}
                  />
                  <Label htmlFor="starAmount">Количество звёзд</Label>
                  <Input
                    id="starAmount"
                    inputMode="numeric"
                    value={starAmount}
                    onChange={(event) => setStarAmount(event.target.value)}
                  />
                </div>
              }
            />

            <Card className="border-destructive/20">
              <CardHeader>
                <CardTitle>{tr("РЈРґР°Р»РµРЅРёРµ Р°РєРєР°СѓРЅС‚Р°")}</CardTitle>
                <CardDescription>
                  {tr("РђРєРєР°СѓРЅС‚, РІР°С€Рё СЃРѕРѕР±С‰РµРЅРёСЏ Рё РґРѕСЃС‚СѓРї Рє РїСЂРёР»РѕР¶РµРЅРёСЋ Р±СѓРґСѓС‚ СѓРґР°Р»РµРЅС‹ Р±РµР· РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ.")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Separator />
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isDeletingAccount}
                  onClick={deleteAccount}
                >
                  {tr("РЈРґР°Р»РёС‚СЊ Р°РєРєР°СѓРЅС‚")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <BottomNav active="settings" />
    </main>
  )
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-border/70 bg-background/75 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function PromoCard({
  icon,
  title,
  badge,
  badgeTone,
  description,
  bullets,
  actionLabel,
  actionVariant,
  footer,
  onAction,
  details,
}: {
  icon: React.ReactNode
  title: string
  badge: string
  badgeTone: string
  description: string
  bullets: string[]
  actionLabel: string
  actionVariant: "default" | "outline" | "secondary"
  footer: string
  onAction?: () => void
  details?: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-[1.7rem] border border-border/70 bg-linear-to-br from-background via-background to-muted/30">
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {icon}
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${badgeTone}`}>
            {badge}
          </span>
        </div>

        <div>
          <p className="text-lg font-semibold">{title}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>

        <div className="space-y-2">
          {bullets.map((bullet) => (
            <div key={bullet} className="flex items-start gap-2 text-sm">
              <StarIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{bullet}</span>
            </div>
          ))}
        </div>

        {details}

        <Button type="button" variant={actionVariant} className="w-full sm:w-auto" onClick={onAction}>
          <RocketIcon className="size-4" />
          {actionLabel}
        </Button>
      </div>

      <div className="border-t border-border/70 bg-muted/45 px-5 py-4 text-sm text-muted-foreground">
        {footer}
      </div>
    </div>
  )
}
