"use client"

import { ArrowLeftIcon, CirclePlusIcon } from "lucide-react"
import { useDeferredValue, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { AccountStatusBadge } from "@/components/ui/account-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LogoutButton } from "@/features/auth/ui/logout-button"
import { useI18n } from "@/features/i18n/model/i18n-provider"
import { LanguageToggle } from "@/features/i18n/ui/language-toggle"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { buildEmblem, getEmblemTone } from "@/features/profile/lib/emblem"
import { ThemeToggle } from "@/features/theme/ui/theme-toggle"

type ProfileUser = {
  id: number
  email: string
  firstName: string
  lastName: string | null
  role: string
}

type ContactUser = {
  id: number
  email: string
  firstName: string
  lastName: string | null
  phone: string
  role: string
}

type SearchUser = ContactUser & {
  isAlreadyContact: boolean
  isBlacklisted: boolean
}

type BlacklistHomeProps = {
  user: ProfileUser
  blacklist: ContactUser[]
}

export function BlacklistHome({
  user,
  blacklist: initialBlacklist,
}: BlacklistHomeProps) {
  const router = useRouter()
  const { tr } = useI18n()
  const [isPending, startTransition] = useTransition()
  const [showAddForm, setShowAddForm] = useState(false)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [blacklist, setBlacklist] = useState<ContactUser[]>(initialBlacklist)
  const [lastCompletedQuery, setLastCompletedQuery] = useState("")
  const emblem = buildEmblem(user.firstName, user.lastName)
  const emblemTone = getEmblemTone(user.firstName, user.lastName)

  useEffect(() => {
    const searchValue = deferredQuery.trim()
    if (!searchValue) {
      return
    }

    const controller = new AbortController()

    fetch(`/api/contacts/search?q=${encodeURIComponent(searchValue)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(tr(data?.message ?? "Не удалось выполнить поиск"))
        }

        return response.json()
      })
      .then((data: { users: SearchUser[] }) => {
        setSearchResults(data.users)
        setLastCompletedQuery(searchValue)
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setLastCompletedQuery(searchValue)
          toast.error(tr(error.message))
        }
      })

    return () => controller.abort()
  }, [deferredQuery])

  const isSearching =
    deferredQuery.trim().length > 0 && lastCompletedQuery !== deferredQuery.trim()

  function addToBlacklist(blockedUserId: number) {
    startTransition(async () => {
      const response = await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockedUserId }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось добавить пользователя в чёрный список"))
        return
      }

      const blockedUser = data.blockedUser as ContactUser
      setBlacklist((prev) => {
        if (prev.some((item) => item.id === blockedUser.id)) {
          return prev
        }

        return [blockedUser, ...prev]
      })
      setSearchResults((prev) =>
        prev.map((item) =>
          item.id === blockedUserId ? { ...item, isBlacklisted: true } : item
        )
      )
      setShowAddForm(false)
      setQuery("")
      setLastCompletedQuery("")
      setSearchResults([])
      toast.success(tr("Пользователь добавлен в чёрный список"))
    })
  }

  function removeFromBlacklist(blockedUserId: number) {
    startTransition(async () => {
      const response = await fetch("/api/blacklist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockedUserId }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось удалить пользователя из чёрного списка"))
        return
      }

      setBlacklist((prev) => prev.filter((item) => item.id !== blockedUserId))
      setSearchResults((prev) =>
        prev.map((item) =>
          item.id === blockedUserId ? { ...item, isBlacklisted: false } : item
        )
      )
      toast.success(tr("Пользователь удалён из чёрного списка"))
    })
  }

  return (
    <main className="h-dvh overflow-hidden bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-6 px-6 py-6 pb-28">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-12 items-center justify-center rounded-full border text-sm font-semibold shadow-sm ${emblemTone}`}
            >
              {emblem}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium">
                  {user.firstName} {user.lastName}
                </p>
                <AccountStatusBadge role={user.role} email={user.email} />
              </div>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>

        <Card className="flex min-h-0 flex-1 flex-col border-border/80 shadow-xl shadow-black/5">
          <CardHeader className="gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">{tr("Чёрный список")}</CardTitle>
                <CardDescription>
                  {tr("Ищите пользователей, добавляйте их в ЧС и управляйте текущим списком.")}
                </CardDescription>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:bg-transparent hover:text-white"
                  onClick={() => {
                    setShowAddForm((prev) => !prev)
                    if (showAddForm) {
                      setQuery("")
                      setLastCompletedQuery("")
                      setSearchResults([])
                    }
                  }}
                  aria-label={showAddForm ? tr("Скрыть поиск") : tr("Добавить в чёрный список")}
                  title={showAddForm ? tr("Скрыть поиск") : tr("Добавить в чёрный список")}
                >
                  <CirclePlusIcon className="size-5" />
                </Button>
                <Button variant="outline" onClick={() => router.push("/contacts")}>
                  <ArrowLeftIcon className="size-4" />
                  {tr("К контактам")}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden">
            {showAddForm && (
              <div className="space-y-3 rounded-xl border border-border/70 p-3">
                <Input
                  value={query}
                  onChange={(event) => {
                    const nextQuery = event.target.value
                    setQuery(nextQuery)

                    if (!nextQuery.trim()) {
                      setSearchResults([])
                      setLastCompletedQuery("")
                    }
                  }}
                  placeholder={tr("Введите имя или телефон")}
                />

                {query.trim().length > 0 && (
                  <div className="min-h-0 space-y-2">
                    {isSearching && (
                      <p className="text-sm text-muted-foreground">{tr("Ищем пользователей...")}</p>
                    )}

                    {!isSearching && searchResults.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {tr("По вашему запросу ничего не найдено.")}
                      </p>
                    )}

                    {!isSearching && (
                      <div className="max-h-[32dvh] space-y-2 overflow-y-auto pr-1">
                        {searchResults.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-medium">
                                  {item.firstName} {item.lastName}
                                </p>
                                <AccountStatusBadge role={item.role} email={item.email} />
                              </div>
                              <p className="truncate text-sm text-muted-foreground">
                                {item.phone} · {item.email}
                              </p>
                            </div>
                            <Button
                              variant={item.isBlacklisted ? "secondary" : "destructive"}
                              disabled={isPending}
                              onClick={() =>
                                item.isBlacklisted
                                  ? removeFromBlacklist(item.id)
                                  : addToBlacklist(item.id)
                              }
                            >
                              {item.isBlacklisted ? tr("Убрать из ЧС") : tr("В ЧС")}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {tr("Пользователи в чёрном списке")}
              </h3>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {blacklist.length === 0 && (
                  <p className="text-sm text-muted-foreground">{tr("Чёрный список пуст.")}</p>
                )}
                {blacklist.map((blockedUser) => (
                  <div
                    key={blockedUser.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {blockedUser.firstName} {blockedUser.lastName}
                        </p>
                        <AccountStatusBadge role={blockedUser.role} email={blockedUser.email} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {blockedUser.phone} · {blockedUser.email}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => removeFromBlacklist(blockedUser.id)}
                    >
                      {tr("Убрать")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <BottomNav active="contacts" />
    </main>
  )
}
