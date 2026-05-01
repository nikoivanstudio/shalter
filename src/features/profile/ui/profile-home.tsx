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
        {/* остальная JSX-разметка у тебя остаётся без изменений */}
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

        <Button type="button" variant={actionVariant} className="w-full sm:w-auto" onClick={onAction}>
          <RocketIcon className="size-4" />
          {actionLabel}
        </Button>
      </div>

      <div className="border-t border-border/70 bg-muted/45 px-5 py-4 text-sm text-muted-foreground">{footer}</div>
    </div>
  )
}