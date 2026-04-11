"use client"

import { useDeferredValue, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LogoutButton } from "@/features/auth/ui/logout-button"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { buildEmblem } from "@/features/profile/lib/emblem"
import { ThemeToggle } from "@/features/theme/ui/theme-toggle"

type ProfileUser = {
  id: number
  email: string
  firstName: string
  lastName: string | null
}

type ContactUser = {
  id: number
  email: string
  firstName: string
  lastName: string | null
  phone: string
}

type SearchUser = ContactUser & {
  isAlreadyContact: boolean
  isBlacklisted: boolean
}

type ContactsHomeProps = {
  user: ProfileUser
  contacts: ContactUser[]
  blacklist: ContactUser[]
}

export function ContactsHome({
  user,
  contacts: initialContacts,
  blacklist: initialBlacklist,
}: ContactsHomeProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [contacts, setContacts] = useState<ContactUser[]>(initialContacts)
  const [blacklist, setBlacklist] = useState<ContactUser[]>(initialBlacklist)
  const [lastCompletedQuery, setLastCompletedQuery] = useState("")
  const emblem = buildEmblem(user.firstName, user.lastName)

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
          throw new Error(data?.message ?? "Не удалось выполнить поиск")
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
          toast.error(error.message)
        }
      })

    return () => controller.abort()
  }, [deferredQuery])

  const isSearching =
    deferredQuery.trim().length > 0 && lastCompletedQuery !== deferredQuery.trim()

  function addContact(contactUserId: number) {
    startTransition(async () => {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactUserId }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось добавить контакт")
        return
      }

      const newContact = data.contact as ContactUser
      setContacts((prev) => {
        if (prev.some((item) => item.id === newContact.id)) {
          return prev
        }

        return [...prev, newContact]
      })
      setSearchResults((prev) =>
        prev.map((item) =>
          item.id === contactUserId ? { ...item, isAlreadyContact: true } : item
        )
      )
      toast.success("Контакт добавлен")
    })
  }

  function removeContact(contactUserId: number) {
    startTransition(async () => {
      const response = await fetch("/api/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactUserId }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось удалить контакт")
        return
      }

      setContacts((prev) => prev.filter((item) => item.id !== contactUserId))
      setSearchResults((prev) =>
        prev.map((item) =>
          item.id === contactUserId ? { ...item, isAlreadyContact: false } : item
        )
      )
      toast.success("Контакт удалён")
    })
  }

  function addToBlacklist(blockedUserId: number) {
    startTransition(async () => {
      const response = await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockedUserId }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось добавить пользователя в чёрный список")
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
      toast.success("Пользователь добавлен в чёрный список")
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
        toast.error(data?.message ?? "Не удалось удалить пользователя из чёрного списка")
        return
      }

      setBlacklist((prev) => prev.filter((item) => item.id !== blockedUserId))
      setSearchResults((prev) =>
        prev.map((item) =>
          item.id === blockedUserId ? { ...item, isBlacklisted: false } : item
        )
      )
      toast.success("Пользователь удалён из чёрного списка")
    })
  }

  return (
    <main className="h-dvh overflow-hidden bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-6 px-6 py-6 pb-28">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full border border-border/80 bg-card text-sm font-semibold shadow-sm">
              {emblem}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>

        <Card className="flex min-h-0 flex-1 flex-col border-border/80 shadow-xl shadow-black/5">
          <CardHeader>
            <CardTitle className="text-2xl">Контакты</CardTitle>
            <CardDescription>
              Поиск пользователей по имени или телефону и добавление в свои контакты.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden">
            <Input
              value={query}
              onChange={(e) => {
                const nextQuery = e.target.value
                setQuery(nextQuery)

                if (!nextQuery.trim()) {
                  setSearchResults([])
                  setLastCompletedQuery("")
                }
              }}
              placeholder="Введите имя или телефон"
            />

            {query.trim().length > 0 && (
              <div className="min-h-0 space-y-2">
                {isSearching && (
                  <p className="text-sm text-muted-foreground">Ищем пользователей...</p>
                )}

                {!isSearching && searchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground">По вашему запросу ничего не найдено.</p>
                )}

                {!isSearching && (
                  <div className="max-h-[32dvh] space-y-2 overflow-y-auto pr-1">
                    {searchResults.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border border-border/70 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {item.firstName} {item.lastName}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {item.phone} · {item.email}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            variant={item.isAlreadyContact ? "secondary" : "default"}
                            disabled={item.isAlreadyContact || isPending}
                            onClick={() => addContact(item.id)}
                          >
                            {item.isAlreadyContact ? "Добавлен" : "Добавить"}
                          </Button>
                          <Button
                            variant={item.isBlacklisted ? "secondary" : "destructive"}
                            disabled={isPending}
                            onClick={() =>
                              item.isBlacklisted
                                ? removeFromBlacklist(item.id)
                                : addToBlacklist(item.id)
                            }
                          >
                            {item.isBlacklisted ? "Убрать из ЧС" : "В ЧС"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Чёрный список</h3>
              <div className="max-h-[22dvh] space-y-2 overflow-y-auto pr-1">
                {blacklist.length === 0 && (
                  <p className="text-sm text-muted-foreground">Чёрный список пуст.</p>
                )}
                {blacklist.map((blockedUser) => (
                  <div
                    key={blockedUser.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {blockedUser.firstName} {blockedUser.lastName}
                      </p>
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
                      Убрать
                    </Button>
                  </div>
                ))}
              </div>

              <h3 className="text-sm font-medium text-muted-foreground">Мои контакты</h3>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {contacts.length === 0 && (
                  <p className="text-sm text-muted-foreground">Контактов пока нет.</p>
                )}
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3 transition-colors hover:bg-muted/40"
                  >
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => router.push(`/chats?contactId=${contact.id}`)}
                    >
                      <p className="font-medium">
                        {contact.firstName} {contact.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {contact.phone} · {contact.email}
                      </p>
                    </button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => removeContact(contact.id)}
                    >
                      Удалить
                    </Button>
                    <Button
                      size="sm"
                      variant={blacklist.some((item) => item.id === contact.id) ? "secondary" : "outline"}
                      disabled={isPending}
                      onClick={() =>
                        blacklist.some((item) => item.id === contact.id)
                          ? removeFromBlacklist(contact.id)
                          : addToBlacklist(contact.id)
                      }
                    >
                      {blacklist.some((item) => item.id === contact.id) ? "Убрать из ЧС" : "В ЧС"}
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
