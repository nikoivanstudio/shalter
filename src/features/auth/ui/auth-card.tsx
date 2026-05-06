"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/features/i18n/model/i18n-provider"
import {
  loginSchema,
  recoveryCodeSchema,
  recoveryPhoneSchema,
  registerSchema,
} from "@/features/auth/model/schemas"
import { TurnstileWidget } from "@/features/auth/ui/turnstile-widget"

type LoginForm = {
  email: string
  password: string
}

type RegisterForm = {
  email: string
  password: string
  confirmPassword: string
  firstName: string
  lastName: string
  username: string
  phone: string
  turnstileToken: string
  referrerId?: number
}

type RecoveryForm = {
  phone: string
  code: string
}

type FieldErrors = Record<string, string[] | undefined>

async function sendAuthRequest(path: string, payload: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => null)
  return { response, data }
}

function getFieldError(errors: FieldErrors, key: string) {
  return errors[key]?.[0]
}

export function AuthCard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { tr } = useI18n()
  const [isPending, startTransition] = useTransition()
  const [serverMessage, setServerMessage] = useState("")
  const [loginErrors, setLoginErrors] = useState<FieldErrors>({})
  const [registerErrors, setRegisterErrors] = useState<FieldErrors>({})
  const [recoveryErrors, setRecoveryErrors] = useState<FieldErrors>({})
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const [isRecoveryConfirmOpen, setIsRecoveryConfirmOpen] = useState(false)
  const [isRecoveryCodeSent, setIsRecoveryCodeSent] = useState(false)
  const [recoveryMessage, setRecoveryMessage] = useState("")

  const [loginForm, setLoginForm] = useState<LoginForm>({
    email: "",
    password: "",
  })

  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    username: "",
    phone: "",
    turnstileToken: "",
  })

  const [recoveryForm, setRecoveryForm] = useState<RecoveryForm>({
    phone: "",
    code: "",
  })

  const isLoginDisabled = useMemo(
    () => isPending || !loginForm.email || !loginForm.password,
    [isPending, loginForm.email, loginForm.password]
  )

  const isRegisterDisabled = useMemo(
    () =>
      isPending ||
      !registerForm.email ||
      !registerForm.password ||
      !registerForm.confirmPassword ||
      !registerForm.firstName ||
      !registerForm.username ||
      !registerForm.phone ||
      !registerForm.turnstileToken,
    [isPending, registerForm]
  )

  const handleTurnstileTokenChange = useCallback((token: string | null) => {
    setRegisterErrors((prev) => ({
      ...prev,
      turnstileToken: undefined,
    }))
    setRegisterForm((prev) => ({
      ...prev,
      turnstileToken: token ?? "",
    }))
  }, [])

  const referrerId = useMemo(() => {
    const refValue = searchParams.get("ref")
    const parsed = refValue ? Number(refValue) : NaN
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }, [searchParams])

  function submitLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerMessage("")
    setLoginErrors({})
    setIsRecoveryConfirmOpen(false)
    setRecoveryErrors({})
    setRecoveryMessage("")

    const parsed = loginSchema.safeParse(loginForm)
    if (!parsed.success) {
      setLoginErrors(parsed.error.flatten().fieldErrors)
      return
    }

    startTransition(async () => {
      const { response, data } = await sendAuthRequest("/api/auth/login", parsed.data)
      if (!response.ok) {
        setLoginErrors((data?.fieldErrors ?? {}) as FieldErrors)
        setServerMessage(tr(data?.message ?? "РћС€РёР±РєР° РІС…РѕРґР°"))
        return
      }

      toast.success(tr("Р’С…РѕРґ РІС‹РїРѕР»РЅРµРЅ"))
      router.replace("/")
      router.refresh()
    })
  }

  function requestRecoveryCode() {
    setRecoveryErrors({})
    setRecoveryMessage("")

    const parsed = recoveryPhoneSchema.safeParse({ phone: recoveryForm.phone })
    if (!parsed.success) {
      setRecoveryErrors(parsed.error.flatten().fieldErrors)
      return
    }

    startTransition(async () => {
      const { response, data } = await sendAuthRequest(
        "/api/auth/recover/request-code",
        parsed.data
      )
      if (!response.ok) {
        setRecoveryErrors((data?.fieldErrors ?? {}) as FieldErrors)
        setRecoveryMessage(tr(data?.message ?? "РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РєРѕРґ"))
        return
      }

      setIsRecoveryCodeSent(true)
      setRecoveryMessage("РљРѕРґ СЃРѕР·РґР°РЅ. Р’РІРµРґРёС‚Рµ РµРіРѕ, С‡С‚РѕР±С‹ РІРѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ Р°РєРєР°СѓРЅС‚.")
      toast.success("РљРѕРґ СЃРѕР·РґР°РЅ")
      return
    })
  }

  function recoverAccount() {
    setRecoveryErrors({})
    setRecoveryMessage("")

    const parsed = recoveryCodeSchema.safeParse(recoveryForm)
    if (!parsed.success) {
      setRecoveryErrors(parsed.error.flatten().fieldErrors)
      return
    }

    startTransition(async () => {
      const { response, data } = await sendAuthRequest("/api/auth/recover", parsed.data)
      if (!response.ok) {
        setRecoveryErrors((data?.fieldErrors ?? {}) as FieldErrors)
        setRecoveryMessage(tr(data?.message ?? "РћС€РёР±РєР° РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ Р°РєРєР°СѓРЅС‚Р°"))
        return
      }

      setIsRecoveryConfirmOpen(false)
      setIsRecoveryCodeSent(false)
      setRecoveryForm({ phone: "", code: "" })
      toast.success(tr("РђРєРєР°СѓРЅС‚ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅ"))
      router.replace("/")
      router.refresh()
    })
  }

  function submitRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerMessage("")
    setRegisterErrors({})

    const parsed = registerSchema.safeParse({
      ...registerForm,
      referrerId,
    })
    if (!parsed.success) {
      setRegisterErrors(parsed.error.flatten().fieldErrors)
      return
    }

    startTransition(async () => {
      const { response, data } = await sendAuthRequest("/api/auth/register", parsed.data)
      if (!response.ok) {
        setRegisterErrors((data?.fieldErrors ?? {}) as FieldErrors)
        setServerMessage(tr(data?.message ?? "РћС€РёР±РєР° СЂРµРіРёСЃС‚СЂР°С†РёРё"))
        setTurnstileResetKey((prev) => prev + 1)
        return
      }

      toast.success(tr("Р РµРіРёСЃС‚СЂР°С†РёСЏ Р·Р°РІРµСЂС€РµРЅР°"))
      router.replace("/")
      router.refresh()
    })
  }

  return (
    <>
      <Card className="w-full max-w-xl border-border/80 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-2xl">{tr("РђРІС‚РѕСЂРёР·Р°С†РёСЏ")}</CardTitle>
          <CardDescription>
            {tr("Р’РѕР№РґРёС‚Рµ РІ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ Р°РєРєР°СѓРЅС‚ РёР»Рё СЃРѕР·РґР°Р№С‚Рµ РЅРѕРІС‹Р№ РїРѕСЃР»Рµ РїСЂРѕРІРµСЂРєРё Turnstile.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{tr("Р’С…РѕРґ")}</TabsTrigger>
              <TabsTrigger value="register">{tr("Р РµРіРёСЃС‚СЂР°С†РёСЏ")}</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form className="space-y-4" onSubmit={submitLogin}>
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginForm.email}
                    onChange={(e) =>
                      setLoginForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  {getFieldError(loginErrors, "email") && (
                    <p className="text-sm text-destructive">{getFieldError(loginErrors, "email")}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">{tr("РџР°СЂРѕР»СЊ")}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    autoComplete="current-password"
                  />
                  {getFieldError(loginErrors, "password") && (
                    <p className="text-sm text-destructive">
                      {getFieldError(loginErrors, "password")}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 text-sm"
                    onClick={() => {
                      setServerMessage("")
                      setLoginErrors({})
                      setRecoveryErrors({})
                      setRecoveryMessage("")
                      setIsRecoveryCodeSent(false)
                      setRecoveryForm({
                        code: "",
                        phone: "",
                      })
                      setIsRecoveryConfirmOpen(true)
                    }}
                    disabled={isPending}
                  >
                    {tr("Р—Р°Р±С‹Р»Рё РїР°СЂРѕР»СЊ?")}
                  </Button>
                </div>
                <Button type="submit" className="w-full" disabled={isLoginDisabled}>
                  {isPending ? tr("Р’С…РѕРґРёРј...") : tr("Р’РѕР№С‚Рё")}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <form className="space-y-4" onSubmit={submitRegister}>
                {referrerId ? (
                  <div className="rounded-2xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-foreground">
                    Р РµРіРёСЃС‚СЂР°С†РёСЏ РїРѕ РїР°СЂС‚РЅС‘СЂСЃРєРѕР№ СЃСЃС‹Р»РєРµ. РџСЂРё СѓСЃРїРµС€РЅРѕР№ Р°РєС‚РёРІР°С†РёРё РїСЂРёРіР»Р°СЃРёРІС€РёР№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ
                    РїРѕР»СѓС‡РёС‚ Р·РІС‘Р·РґС‹.
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="register-first-name">{tr("РРјСЏ")}</Label>
                    <Input
                      id="register-first-name"
                      value={registerForm.firstName}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({ ...prev, firstName: e.target.value }))
                      }
                      autoComplete="given-name"
                    />
                    {getFieldError(registerErrors, "firstName") && (
                      <p className="text-sm text-destructive">
                        {getFieldError(registerErrors, "firstName")}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-last-name">{tr("Р¤Р°РјРёР»РёСЏ (РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ)")}</Label>
                    <Input
                      id="register-last-name"
                      value={registerForm.lastName}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({ ...prev, lastName: e.target.value }))
                      }
                      autoComplete="family-name"
                      placeholder={tr("РњРѕР¶РЅРѕ РѕСЃС‚Р°РІРёС‚СЊ РїСѓСЃС‚С‹Рј")}
                    />
                    {getFieldError(registerErrors, "lastName") && (
                      <p className="text-sm text-destructive">
                        {getFieldError(registerErrors, "lastName")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    value={registerForm.email}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    autoComplete="email"
                  />
                  {getFieldError(registerErrors, "email") && (
                    <p className="text-sm text-destructive">{getFieldError(registerErrors, "email")}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-username">Username</Label>
                  <Input
                    id="register-username"
                    value={registerForm.username}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({ ...prev, username: e.target.value }))
                    }
                    autoComplete="username"
                    placeholder="my_username"
                  />
                  {getFieldError(registerErrors, "username") && (
                    <p className="text-sm text-destructive">{getFieldError(registerErrors, "username")}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-phone">{tr("РўРµР»РµС„РѕРЅ")}</Label>
                  <Input
                    id="register-phone"
                    value={registerForm.phone}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    autoComplete="tel"
                    placeholder="+7..."
                  />
                  {getFieldError(registerErrors, "phone") && (
                    <p className="text-sm text-destructive">{getFieldError(registerErrors, "phone")}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">{tr("РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ")}</p>
                  <div id="register-turnstile" className="space-y-2">
                    <TurnstileWidget
                      resetKey={turnstileResetKey}
                      onTokenChange={handleTurnstileTokenChange}
                    />
                  </div>
                  {getFieldError(registerErrors, "turnstileToken") && (
                    <p className="text-sm text-destructive">
                      {getFieldError(registerErrors, "turnstileToken")}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="register-password">{tr("РџР°СЂРѕР»СЊ")}</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={registerForm.password}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({ ...prev, password: e.target.value }))
                      }
                      autoComplete="new-password"
                    />
                    {getFieldError(registerErrors, "password") && (
                      <p className="text-sm text-destructive">
                        {getFieldError(registerErrors, "password")}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm-password">{tr("РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РїР°СЂРѕР»СЏ")}</Label>
                    <Input
                      id="register-confirm-password"
                      type="password"
                      value={registerForm.confirmPassword}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                      autoComplete="new-password"
                    />
                    {getFieldError(registerErrors, "confirmPassword") && (
                      <p className="text-sm text-destructive">
                        {getFieldError(registerErrors, "confirmPassword")}
                      </p>
                    )}
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isRegisterDisabled}>
                  {isPending ? tr("Р РµРіРёСЃС‚СЂРёСЂСѓРµРј...") : tr("Р—Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°С‚СЊСЃСЏ")}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {serverMessage && <p className="mt-4 text-sm text-destructive">{serverMessage}</p>}
        </CardContent>
      </Card>

      {isRecoveryConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <h3 className="text-xl font-semibold">Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ РґРѕСЃС‚СѓРї?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Укажите номер телефона, который привязан к аккаунту. Затем создайте код и
              введите его ниже для восстановления доступа.
            </p>
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="recovery-phone">РЈРєР°Р·Р°РЅРЅС‹Р№ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°</Label>
                <Input
                  id="recovery-phone"
                  type="tel"
                  value={recoveryForm.phone}
                  onChange={(e) =>
                    setRecoveryForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  autoComplete="tel"
                />
                {getFieldError(recoveryErrors, "phone") && (
                  <p className="text-sm text-destructive">
                    {getFieldError(recoveryErrors, "phone")}
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={requestRecoveryCode}
                disabled={isPending}
              >
                {isPending ? tr("РћС‚РїСЂР°РІР»СЏРµРј...") : "РџСЂРѕРґРѕР»Р¶РёС‚СЊ"}
              </Button>

              {isRecoveryCodeSent && (
                <div className="space-y-2">
                  <Label htmlFor="recovery-code">РљРѕРґ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ</Label>
                  <Input
                    id="recovery-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={recoveryForm.code}
                    onChange={(e) =>
                      setRecoveryForm((prev) => ({
                        ...prev,
                        code: e.target.value.replace(/\D/g, "").slice(0, 6),
                      }))
                    }
                    placeholder="123456"
                  />
                  {getFieldError(recoveryErrors, "code") && (
                    <p className="text-sm text-destructive">
                      {getFieldError(recoveryErrors, "code")}
                    </p>
                  )}
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                {tr("РџРѕСЃР»Рµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ РєРѕРЅС‚Р°РєС‚С‹, С‡С‘СЂРЅС‹Р№ СЃРїРёСЃРѕРє Рё РІСЃРµ С‡Р°С‚С‹ Р±СѓРґСѓС‚ РѕС‡РёС‰РµРЅС‹.")}
              </p>

              {recoveryMessage && (
                <p className="text-sm text-muted-foreground">{recoveryMessage}</p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsRecoveryConfirmOpen(false)
                  setIsRecoveryCodeSent(false)
                  setRecoveryErrors({})
                  setRecoveryMessage("")
                }}
                disabled={isPending}
              >
                {tr("РќРµС‚")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={recoverAccount}
                disabled={isPending || !isRecoveryCodeSent}
              >
                {isPending ? tr("РЎР±СЂР°СЃС‹РІР°РµРј...") : "Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}