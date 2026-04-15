"use client"

import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { loginSchema, registerSchema } from "@/features/auth/model/schemas"
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
  phone: string
  turnstileToken: string
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
  const [isPending, startTransition] = useTransition()
  const [serverMessage, setServerMessage] = useState("")
  const [loginErrors, setLoginErrors] = useState<FieldErrors>({})
  const [registerErrors, setRegisterErrors] = useState<FieldErrors>({})
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)

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
    phone: "",
    turnstileToken: "",
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

  function submitLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerMessage("")
    setLoginErrors({})

    const parsed = loginSchema.safeParse(loginForm)
    if (!parsed.success) {
      setLoginErrors(parsed.error.flatten().fieldErrors)
      return
    }

    startTransition(async () => {
      const { response, data } = await sendAuthRequest("/api/auth/login", parsed.data)
      if (!response.ok) {
        setLoginErrors((data?.fieldErrors ?? {}) as FieldErrors)
        setServerMessage(data?.message ?? "Ошибка входа")
        return
      }

      toast.success("Вход выполнен")
      router.replace("/")
      router.refresh()
    })
  }

  function submitRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerMessage("")
    setRegisterErrors({})

    const parsed = registerSchema.safeParse(registerForm)
    if (!parsed.success) {
      setRegisterErrors(parsed.error.flatten().fieldErrors)
      return
    }

    startTransition(async () => {
      const { response, data } = await sendAuthRequest("/api/auth/register", parsed.data)
      if (!response.ok) {
        setRegisterErrors((data?.fieldErrors ?? {}) as FieldErrors)
        setServerMessage(data?.message ?? "Ошибка регистрации")
        setTurnstileResetKey((prev) => prev + 1)
        return
      }

      toast.success("Регистрация завершена")
      router.replace("/")
      router.refresh()
    })
  }

  return (
    <Card className="w-full max-w-xl border-border/80 shadow-xl shadow-black/5">
      <CardHeader>
        <CardTitle className="text-2xl">Авторизация</CardTitle>
        <CardDescription>
          Войдите в существующий аккаунт или создайте новый после проверки Turnstile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Вход</TabsTrigger>
            <TabsTrigger value="register">Регистрация</TabsTrigger>
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
                <Label htmlFor="login-password">Пароль</Label>
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
              </div>
              <Button type="submit" className="w-full" disabled={isLoginDisabled}>
                {isPending ? "Входим..." : "Войти"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register" className="space-y-4">
            <form className="space-y-4" onSubmit={submitRegister}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="register-first-name">Имя</Label>
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
                  <Label htmlFor="register-last-name">Фамилия</Label>
                  <Input
                    id="register-last-name"
                    value={registerForm.lastName}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({ ...prev, lastName: e.target.value }))
                    }
                    autoComplete="family-name"
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
                <Label htmlFor="register-phone">Телефон</Label>
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
                <p className="text-sm font-medium">Подтверждение</p>
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
                  <Label htmlFor="register-password">Пароль</Label>
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
                  <Label htmlFor="register-confirm-password">Подтверждение пароля</Label>
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
                {isPending ? "Регистрируем..." : "Зарегистрироваться"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {serverMessage && <p className="mt-4 text-sm text-destructive">{serverMessage}</p>}
      </CardContent>
    </Card>
  )
}
