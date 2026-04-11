"use client"

import { EllipsisVerticalIcon } from "lucide-react"
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
  const [openContactMenuId, setOpenContactMenuId] = useState<number | null>(null)
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

      setOpenContactMenuId(null)
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

      setOpenContactMenuId(null)
      const blockedUser = data.blockedUser as ContactUser
      setBlacklist((prev) => {
        if (prev.some((item) => item.id === blockedUser.id)) {
          return prev
        }

        return [blockedUser, ...prev]
      })
      setContacts((prev) => prev.filter((item) => item.id !== blockedUserId))
      setSearchResults((prev) =>
        prev.map((item) =>
          item.id === blockedUserId
            ? { ...item, isBlacklisted: true, isAlreadyContact: false }
            : item
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">Контакты</CardTitle>
                <CardDescription>
                  Поиск пользователей по имени или телефону и добавление в свои контакты.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => router.push("/blacklist")}>
                Открыть чёрный список
              </Button>
            </div>
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
                    <div className="relative">
                      <button
                        type="button"
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Действия с контактом"
                        onClick={() =>
                          setOpenContactMenuId((prev) =>
                            prev === contact.id ? null : contact.id
                          )
                        }
                        disabled={isPending}
                      >
                        <EllipsisVerticalIcon className="size-4" />
                      </button>
                      {openContactMenuId === contact.id && (
                        <div className="absolute right-0 top-9 z-20 min-w-44 rounded-md border border-border bg-popover p-1 shadow-md">
                          <button
                            type="button"
                            className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => removeContact(contact.id)}
                            disabled={isPending}
                          >
                            Удалить контакт
                          </button>
                          <button
                            type="button"
                            className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() =>
                              blacklist.some((item) => item.id === contact.id)
                                ? removeFromBlacklist(contact.id)
                                : addToBlacklist(contact.id)
                            }
                            disabled={isPending}
                          >
                            {blacklist.some((item) => item.id === contact.id)
                              ? "Убрать из ЧС"
                              : "Добавить в ЧС"}
                          </button>
                        </div>
                      )}
                    </div>
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
