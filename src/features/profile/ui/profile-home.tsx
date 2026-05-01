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
import { giftCatalog, hasInfiniteStars, PARTNER_REWARD_STARS } from "@/shared/lib/rewards/catalog"
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
    phone: user.phone,
    avatarTone: user.avatarTone,
  })
  const [passwordForm, setPasswordForm] = useState<ChangePasswordInput>({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  })
  const [starsBalance, setStarsBalance] = useState(user.starsBalance ?? 0)
  const [giftRecipientEmail, setGiftRecipientEmail] = useState("")
  const [giftNote, setGiftNote] = useState("")
  const [giftKey, setGiftKey] = useState(giftCatalog[0]?.key ?? "coffee")
  const [starRecipientEmail, setStarRecipientEmail] = useState("")
  const [starAmount, setStarAmount] = useState("25")

  const lastName = form.lastName ?? null
  const displayName = `${form.firstName} ${lastName ?? ""}`.trim()
  const isPremium = normalizeRole(user.role) === PREMIUM_ROLE
  const isAdminWithInfiniteStars = hasInfiniteStars(user.role)
  const partnerLink = `https://shalter.ru/auth?ref=${user.id}`

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreviewUrl)
      }
    }
  }, [avatarPreviewUrl])

  function updateField<K extends keyof UpdateProfileInput>(key: K, value: UpdateProfileInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
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
        phone: data.user.phone,
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

      toast.success("Звёзды отправлены")
    })
  }

  return (
    <main className="min-h-screen px-4 py-5 pb-28 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <header className="rounded-[2rem] border border-white/50 bg-card/88 px-5 py-4 shadow-[0_20px_55px_-32px_rgba(15,23,42,0.48)] backdrop-blur-xl dark:border-white/8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <UserAvatar
                firstName={form.firstName}
                lastName={lastName}
                avatarTone={form.avatarTone}
                avatarUrl={avatarPreviewUrl}
                className="size-14"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-lg font-semibold">{displayName || tr("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ")}</p>
                  <AccountStatusBadge
                    role={user.role}
                    email={form.email}
                    firstName={form.firstName}
                    lastName={lastName}
                  />
                </div>
                <p className="truncate text-sm text-muted-foreground">{tr("Р’Р°С€ РїСЂРѕС„РёР»СЊ Рё Р±РµР·РѕРїР°СЃРЅРѕСЃС‚СЊ")}</p>
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
            <CardTitle className="text-2xl font-semibold tracking-tight">{tr("РќР°СЃС‚СЂРѕР№РєРё РїСЂРѕС„РёР»СЏ")}</CardTitle>
            <CardDescription>{tr("РР·РјРµРЅРµРЅРёСЏ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РІ Р±Р°Р·Рµ РґР°РЅРЅС‹С… Р±РµР· СЃРјРµРЅС‹ РїР°СЂРѕР»СЏ.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <form className="space-y-5" onSubmit={onSaveProfile}>
              <div className="space-y-2">
                <Label htmlFor="profile-avatar">{tr("РђРІР°С‚Р°СЂРєР°")}</Label>
                <div className="flex flex-wrap items-center gap-4 rounded-[1.4rem] border border-border/70 bg-background/72 p-4">
                  <UserAvatar
                    firstName={form.firstName}
                    lastName={lastName}
                    avatarTone={form.avatarTone}
                    avatarUrl={avatarPreviewUrl}
                    className="size-20"
                    textClassName="text-lg font-semibold"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Input
                      id="profile-avatar"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(event) => onAvatarChange(event.target.files?.[0] ?? null)}
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CameraIcon className="size-4" />
                        PNG, JPG, WEBP РёР»Рё GIF РґРѕ 5 РњР‘
                      </span>
                      {avatarFile ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => onAvatarChange(null)}>
                          <XIcon className="size-4" />
                          РЈР±СЂР°С‚СЊ С„Р°Р№Р»
                        </Button>
                      ) : null}
                    </div>
                    {getFieldError(fieldErrors, "avatarFile") && (
                      <p className="text-sm text-destructive">{getFieldError(fieldErrors, "avatarFile")}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-first-name">{tr("РРјСЏ")}</Label>
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
                <Label htmlFor="profile-last-name">{tr("Р¤Р°РјРёР»РёСЏ (РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ)")}</Label>
                <Input
                  id="profile-last-name"
                  value={form.lastName ?? ""}
                  onChange={(e) => updateField("lastName", e.target.value)}
                  autoComplete="family-name"
                  placeholder={tr("РњРѕР¶РЅРѕ РѕСЃС‚Р°РІРёС‚СЊ РїСѓСЃС‚С‹Рј")}
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
                <Label htmlFor="profile-phone">{tr("РўРµР»РµС„РѕРЅ")}</Label>
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
                <Label>{tr("Р¦РІРµС‚ Р°РІР°С‚Р°СЂРєРё")}</Label>
                <div className="flex flex-wrap gap-2">
                  {EMBLEM_TONE_OPTIONS.map((tone) => {
                    const active = form.avatarTone === tone.id

                    return (
                      <button
                        key={tone.id}
                        type="button"
                        className={`flex size-10 items-center justify-center rounded-full border-2 transition-transform hover:scale-105 ${tone.className} ${active ? "border-foreground/70" : "border-transparent"}`}
                        onClick={() => updateField("avatarTone", tone.id)}
                        aria-label={tr("Р’С‹Р±РµСЂРёС‚Рµ С†РІРµС‚ Р°РІР°С‚Р°СЂРєРё")}
                        title={tr("Р’С‹Р±РµСЂРёС‚Рµ С†РІРµС‚ Р°РІР°С‚Р°СЂРєРё")}
                      >
                        {active ? "вЂў" : ""}
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
                {isPending ? tr("РЎРѕС…СЂР°РЅСЏРµРј...") : tr("РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС„РёР»СЊ")}
              </Button>
            </form>

            <Separator />

            <form className="space-y-5" onSubmit={onChangePassword}>
              <div>
                <p className="text-sm font-medium">{tr("РР·РјРµРЅРµРЅРёРµ РїР°СЂРѕР»СЏ")}</p>
                <p className="text-sm text-muted-foreground">
                  {tr("РЈРєР°Р¶РёС‚Рµ С‚РµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ Рё РґРІР°Р¶РґС‹ РІРІРµРґРёС‚Рµ РЅРѕРІС‹Р№.")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-current-password">{tr("РўРµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ")}</Label>
                <Input
                  id="profile-current-password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => updatePasswordField("currentPassword", e.target.value)}
                  autoComplete="current-password"
                />
                {getFieldError(passwordErrors, "currentPassword") && (
                  <p className="text-sm text-destructive">{getFieldError(passwordErrors, "currentPassword")}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-new-password">{tr("РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ")}</Label>
                <Input
                  id="profile-new-password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => updatePasswordField("newPassword", e.target.value)}
                  autoComplete="new-password"
                />
                {getFieldError(passwordErrors, "newPassword") && (
                  <p className="text-sm text-destructive">{getFieldError(passwordErrors, "newPassword")}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-confirm-new-password">{tr("РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РЅРѕРІРѕРіРѕ РїР°СЂРѕР»СЏ")}</Label>
                <Input
                  id="profile-confirm-new-password"
                  type="password"
                  value={passwordForm.confirmNewPassword}
                  onChange={(e) => updatePasswordField("confirmNewPassword", e.target.value)}
                  autoComplete="new-password"
                />
                {getFieldError(passwordErrors, "confirmNewPassword") && (
                  <p className="text-sm text-destructive">{getFieldError(passwordErrors, "confirmNewPassword")}</p>
                )}
              </div>

              {passwordMessage && <p className="text-sm text-destructive">{passwordMessage}</p>}

              <Button type="submit" variant="outline" className="w-full sm:w-auto" disabled={isPending}>
                {isPending ? tr("РР·РјРµРЅСЏРµРј РїР°СЂРѕР»СЊ...") : tr("РР·РјРµРЅРёС‚СЊ РїР°СЂРѕР»СЊ")}
              </Button>
            </form>

            <Separator />

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-destructive">{tr("РЈРґР°Р»РµРЅРёРµ Р°РєРєР°СѓРЅС‚Р°")}</p>
                <p className="text-sm text-muted-foreground">
                  {tr("РђРєРєР°СѓРЅС‚, РІР°С€Рё СЃРѕРѕР±С‰РµРЅРёСЏ Рё РґРѕСЃС‚СѓРї Рє РїСЂРёР»РѕР¶РµРЅРёСЋ Р±СѓРґСѓС‚ СѓРґР°Р»РµРЅС‹ Р±РµР· РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ.")}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={isDeletingAccount}
                onClick={deleteAccount}
              >
                {isDeletingAccount ? tr("РЈРґР°Р»СЏРµРј Р°РєРєР°СѓРЅС‚...") : tr("РЈРґР°Р»РёС‚СЊ Р°РєРєР°СѓРЅС‚")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
          <CardHeader className="border-b border-border/55 pb-5">
            <CardTitle className="text-2xl font-semibold tracking-tight">Р’РѕР·РјРѕР¶РЅРѕСЃС‚Рё СЂРѕСЃС‚Р°</CardTitle>
            <CardDescription>
              РџСЂРµРјРёСѓРј РѕС‚РєСЂС‹РІР°РµС‚ СѓСЃРёР»РµРЅРЅС‹Р№ СЂРµР¶РёРј, Р° РїР°СЂС‚РЅС‘СЂСЃРєР°СЏ РїСЂРѕРіСЂР°РјРјР° РїРѕРјРѕРіР°РµС‚ Р·Р°СЂР°Р±Р°С‚С‹РІР°С‚СЊ РЅР°
              СЂРµРєРѕРјРµРЅРґР°С†РёСЏС… Рё РІРЅРµРґСЂРµРЅРёСЏС….
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <PromoCard
              icon={<GemIcon className="size-5" />}
              title="РџСЂРµРјРёСѓРј"
              badge={isPremium ? "РђРєС‚РёРІРµРЅ" : "Р”РѕСЃС‚СѓРїРµРЅ"}
              badgeTone={isPremium ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-primary/10 text-primary"}
              description="Р”Р»СЏ Р°РєС‚РёРІРЅС‹С… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ Рё РєРѕРјР°РЅРґ, РєРѕС‚РѕСЂС‹Рј РЅСѓР¶РЅС‹ СЂР°СЃС€РёСЂРµРЅРЅС‹Рµ Р»РёРјРёС‚С‹, Р±РѕР»РµРµ СЃРёР»СЊРЅС‹Рµ СЃС†РµРЅР°СЂРёРё Рё Р±С‹СЃС‚СЂС‹Р№ РґРѕСЃС‚СѓРї Рє РЅРѕРІС‹Рј С„СѓРЅРєС†РёСЏРј."
              bullets={[
                "Р Р°СЃС€РёСЂРµРЅРЅС‹Рµ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё РґР»СЏ Р±РѕС‚РѕРІ",
                "РџСЂРёРѕСЂРёС‚РµС‚РЅС‹Р№ РґРѕСЃС‚СѓРї Рє РЅРѕРІС‹Рј РёРЅСЃС‚СЂСѓРјРµРЅС‚Р°Рј",
                "Р‘РѕР»РµРµ СѓРґРѕР±РЅС‹Р№ СЂРµР¶РёРј РґР»СЏ Р±РёР·РЅРµСЃР°",
              ]}
              actionLabel={isPremium ? "РџСЂРµРјРёСѓРј Р°РєС‚РёРІРµРЅ" : "РЎРєРѕСЂРѕ РїРѕРґРєР»СЋС‡РёРј"}
              actionVariant={isPremium ? "secondary" : "default"}
              footer={isPremium ? "Р’Р°С€ Р°РєРєР°СѓРЅС‚ СѓР¶Рµ СЂР°Р±РѕС‚Р°РµС‚ РІ РїСЂРµРјРёСѓРј-СЂРµР¶РёРјРµ." : "РџРѕРґРѕР№РґС‘С‚, РµСЃР»Рё РІС‹ С‡Р°СЃС‚Рѕ РёСЃРїРѕР»СЊР·СѓРµС‚Рµ Р±РѕС‚РѕРІ Рё СЂР°Р±РѕС‡РёРµ СЃС†РµРЅР°СЂРёРё."}
              details={
                <div className="grid gap-2 rounded-2xl border border-border/70 bg-background/80 px-3 py-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Баланс</p>
                    <p className="mt-1 font-semibold">
                      {isAdminWithInfiniteStars ? "Бесконечные звёзды" : `${starsBalance} звёзд`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Партнёрская программа</p>
                    <p className="mt-1 font-semibold">{user.partnerStarsEarned ?? 0} звёзд</p>
                  </div>
                </div>
              }
            />

            <PromoCard
              icon={<HandCoinsIcon className="size-5" />}
              title="РџР°СЂС‚РЅС‘СЂСЃРєР°СЏ РїСЂРѕРіСЂР°РјРјР°"
              badge="РќРѕРІР°СЏ"
              badgeTone="bg-amber-500/12 text-amber-700 dark:text-amber-300"
              description="РџСЂРёРіР»Р°С€Р°Р№С‚Рµ РєР»РёРµРЅС‚РѕРІ Рё РєРѕРјР°РЅРґС‹ РІ Shalter, РґРµР»РёС‚РµСЃСЊ СЃРІРѕРёРј СЂРµС€РµРЅРёРµРј Рё РїРѕР»СѓС‡Р°Р№С‚Рµ Р±РѕРЅСѓСЃ Р·Р° Р°РєС‚РёРІРЅС‹Рµ РїРѕРґРєР»СЋС‡РµРЅРёСЏ."
              bullets={[
                "РџРµСЂСЃРѕРЅР°Р»СЊРЅР°СЏ РїР°СЂС‚РЅС‘СЂСЃРєР°СЏ СЃСЃС‹Р»РєР°",
                "Р‘РѕРЅСѓСЃС‹ Р·Р° РїСЂРёРІРµРґС‘РЅРЅС‹Рµ РѕРїР»Р°С‚С‹",
                "РџРѕРґС…РѕРґРёС‚ Р°РіРµРЅС‚СЃС‚РІР°Рј Рё РёРЅС‚РµРіСЂР°С‚РѕСЂР°Рј",
              ]}
              actionLabel="Скопировать ссылку"
              actionVariant="outline"
              footer="РҐРѕСЂРѕС€РёР№ РІР°СЂРёР°РЅС‚ РґР»СЏ С‚РµС…, РєС‚Рѕ РІРЅРµРґСЂСЏРµС‚ Р±РѕС‚РѕРІ, РєР°РЅР°Р»С‹ Рё СЂР°Р±РѕС‡РёРµ РїСЂРѕС†РµСЃСЃС‹ РґСЂСѓРіРёРј."
              onAction={handlePartnerProgramAction}
              details={
                <div className="rounded-2xl border border-border/70 bg-background/80 px-3 py-2">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Партнёрская ссылка
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-foreground">{partnerLink}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    За каждую регистрацию по ссылке начисляется {PARTNER_REWARD_STARS} звёзд.
                  </p>
                </div>
              }
            />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
          <CardHeader className="border-b border-border/55 pb-5">
            <CardTitle className="text-2xl font-semibold tracking-tight">Звёзды и подарки</CardTitle>
            <CardDescription>
              Администратор дарит звёзды без лимита, а пользователи могут тратить свои звёзды на подарки.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-[1.5rem] border border-border/70 bg-background/72 p-4">
              <div>
                <p className="text-lg font-semibold">Кошелёк</p>
                <p className="text-sm text-muted-foreground">
                  {isAdminWithInfiniteStars
                    ? "У администратора бесконечные звёзды для поощрений и подарков."
                    : "Используйте звёзды для покупки подарков другим пользователям."}
                </p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/8 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Сейчас доступно</p>
                <p className="mt-1 text-2xl font-semibold">
                  {isAdminWithInfiniteStars ? "∞" : starsBalance}
                </p>
              </div>
              {isAdminWithInfiniteStars ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="star-recipient-email">Email получателя звёзд</Label>
                    <Input
                      id="star-recipient-email"
                      type="email"
                      value={starRecipientEmail}
                      onChange={(event) => setStarRecipientEmail(event.target.value)}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="star-amount">Количество звёзд</Label>
                    <Input
                      id="star-amount"
                      inputMode="numeric"
                      value={starAmount}
                      onChange={(event) => setStarAmount(event.target.value.replace(/[^\d]/g, ""))}
                    />
                  </div>
                  <Button type="button" onClick={sendStars} disabled={isRewardPending}>
                    {isRewardPending ? "Отправляем..." : "Подарить звёзды"}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-4 rounded-[1.5rem] border border-border/70 bg-background/72 p-4">
              <div>
                <p className="text-lg font-semibold">Магазин подарков</p>
                <p className="text-sm text-muted-foreground">
                  Выберите подарок, укажите email получателя и оплатите его звёздами.
                </p>
              </div>
              <div className="grid gap-3">
                {giftCatalog.map((gift) => (
                  <button
                    key={gift.key}
                    type="button"
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      giftKey === gift.key
                        ? "border-primary bg-primary/8"
                        : "border-border/70 bg-background/80"
                    }`}
                    onClick={() => setGiftKey(gift.key)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{gift.name}</p>
                        <p className="text-sm text-muted-foreground">{gift.description}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">{gift.cost} ★</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="gift-recipient-email">Email получателя подарка</Label>
                <Input
                  id="gift-recipient-email"
                  type="email"
                  value={giftRecipientEmail}
                  onChange={(event) => setGiftRecipientEmail(event.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gift-note">Комментарий</Label>
                <Input
                  id="gift-note"
                  value={giftNote}
                  onChange={(event) => setGiftNote(event.target.value)}
                  placeholder="За хороший запуск"
                />
              </div>
              <Button type="button" variant="outline" onClick={sendGift} disabled={isRewardPending}>
                {isRewardPending ? "Отправляем..." : "Купить и отправить подарок"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <BottomNav active="settings" />
    </main>
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
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${badgeTone}`}>{badge}</span>
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

        <Button
          type="button"
          variant={actionVariant}
          className="w-full sm:w-auto"
          onClick={onAction}
        >
          <RocketIcon className="size-4" />
          {actionLabel}
        </Button>
      </div>

      <div className="border-t border-border/70 bg-muted/45 px-5 py-4 text-sm text-muted-foreground">{footer}</div>
    </div>
  )
}

