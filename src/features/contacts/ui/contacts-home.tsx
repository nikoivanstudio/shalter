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
}

type ContactsHomeProps = {
  user: ProfileUser
  contacts: ContactUser[]
}

export function ContactsHome({ user, contacts: initialContacts }: ContactsHomeProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [contacts, setContacts] = useState<ContactUser[]>(initialContacts)
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6 pb-28">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
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

        <Card className="border-border/80 shadow-xl shadow-black/5">
          <CardHeader>
            <CardTitle className="text-2xl">Контакты</CardTitle>
            <CardDescription>
              Поиск пользователей по имени или телефону и добавление в свои контакты.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <div className="space-y-2">
                {isSearching && (
                  <p className="text-sm text-muted-foreground">Ищем пользователей...</p>
                )}

                {!isSearching && searchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground">По вашему запросу ничего не найдено.</p>
                )}

                {!isSearching &&
                  searchResults.map((item) => (
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
                      <Button
                        variant={item.isAlreadyContact ? "secondary" : "default"}
                        disabled={item.isAlreadyContact || isPending}
                        onClick={() => addContact(item.id)}
                      >
                        {item.isAlreadyContact ? "Добавлен" : "Добавить"}
                      </Button>
                    </div>
                  ))}
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Мои контакты</h3>
              {contacts.length === 0 && (
                <p className="text-sm text-muted-foreground">Контактов пока нет.</p>
              )}
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  className="w-full rounded-lg border border-border/70 p-3 text-left transition-colors hover:bg-muted/40"
                  onClick={() => router.push(`/chats?contactId=${contact.id}`)}
                >
                  <p className="font-medium">
                    {contact.firstName} {contact.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {contact.phone} · {contact.email}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <BottomNav active="contacts" />
    </main>
  )
}
