"use client"

import { EllipsisVerticalIcon } from "lucide-react"
import { useDeferredValue, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { AccountStatusBadge } from "@/components/ui/account-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LogoutButton } from "@/features/auth/ui/logout-button"
import {
  ContactProfileCard,
  type ViewedContactProfile,
} from "@/features/contacts/ui/contact-profile-card"
import { useI18n } from "@/features/i18n/model/i18n-provider"
import { LanguageToggle } from "@/features/i18n/ui/language-toggle"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { buildEmblem, getEmblemTone } from "@/features/profile/lib/emblem"
import { ThemeToggle } from "@/features/theme/ui/theme-toggle"
import {
  canAssignManagedRole,
  DEVELOPER_ROLE,
  PREMIUM_ROLE,
  USER_ROLE,
  type ManagedUserRole,
} from "@/shared/lib/auth/roles"
import { CountryFlagBadge } from "@/shared/ui/country-flag-badge"

type ProfileUser = {
  id: number
  email: string
  firstName: string
  lastName: string | null
  phone?: string | null
  role: string
  avatarTone: string | null
  avatarUrl?: string | null
}

type ContactUser = {
  id: number
  email: string
  firstName: string
  lastName: string | null
  phone: string
  role: string
  isBlocked: boolean
  avatarTone?: string | null
  avatarUrl?: string | null
}

type SearchUser = ContactUser & {
  isAlreadyContact: boolean
  isBlacklisted: boolean
}

const managedRoleButtons: Array<{
  role: ManagedUserRole
  labelKey: string
}> = [
  { role: USER_ROLE, labelKey: "Сделать обычным" },
  { role: PREMIUM_ROLE, labelKey: "Выдать Premium" },
  { role: DEVELOPER_ROLE, labelKey: "Выдать статус разработчика" },
]

export type ContactsHomeProps = {
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
  const { tr } = useI18n()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [contacts, setContacts] = useState<ContactUser[]>(initialContacts)
  const [blacklist, setBlacklist] = useState<ContactUser[]>(initialBlacklist)
  const [lastCompletedQuery, setLastCompletedQuery] = useState("")
  const [openContactMenuId, setOpenContactMenuId] = useState<number | null>(null)
  const [roleUpdateUserId, setRoleUpdateUserId] = useState<number | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<ViewedContactProfile | null>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const emblem = buildEmblem(user.firstName, user.lastName)
  const emblemTone = getEmblemTone(user.firstName, user.lastName, user.avatarTone)
  const canManageRoles = canAssignManagedRole(user.role)

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
  }, [deferredQuery, tr])

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
        toast.error(tr(data?.message ?? "Не удалось добавить контакт"))
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
      toast.success(tr("Контакт добавлен"))
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
        toast.error(tr(data?.message ?? "Не удалось удалить контакт"))
        return
      }

      setOpenContactMenuId(null)
      setContacts((prev) => prev.filter((item) => item.id !== contactUserId))
      setSearchResults((prev) =>
        prev.map((item) =>
          item.id === contactUserId ? { ...item, isAlreadyContact: false } : item
        )
      )
      toast.success(tr("Контакт удалён"))
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
        toast.error(tr(data?.message ?? "Не удалось добавить пользователя в чёрный список"))
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

  function applyRoleUpdate(nextUser: ContactUser) {
    setContacts((prev) =>
      prev.map((item) =>
        item.id === nextUser.id ? { ...item, role: nextUser.role, isBlocked: nextUser.isBlocked } : item
      )
    )
    setBlacklist((prev) =>
      prev.map((item) =>
        item.id === nextUser.id ? { ...item, role: nextUser.role, isBlocked: nextUser.isBlocked } : item
      )
    )
    setSearchResults((prev) =>
      prev.map((item) =>
        item.id === nextUser.id ? { ...item, role: nextUser.role, isBlocked: nextUser.isBlocked } : item
      )
    )
  }

  function updateUserBlockedState(targetUserId: number, isBlocked: boolean) {
    if (!canManageRoles) {
      return
    }

    setRoleUpdateUserId(targetUserId)
    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${targetUserId}/block`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось обновить блокировку"))
        setRoleUpdateUserId(null)
        return
      }

      applyRoleUpdate(data.user as ContactUser)
      setOpenContactMenuId(null)
      setRoleUpdateUserId(null)
      toast.success(tr("Статус блокировки обновлён"))
    })
  }

  function updateUserRole(targetUserId: number, role: ManagedUserRole) {
    if (!canManageRoles) {
      return
    }

    if (targetUserId === user.id) {
      toast.error(tr("Нельзя изменить собственную роль"))
      return
    }

    setRoleUpdateUserId(targetUserId)
    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${targetUserId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось обновить роль"))
        setRoleUpdateUserId(null)
        return
      }

      applyRoleUpdate(data.user as ContactUser)
      setOpenContactMenuId(null)
      setRoleUpdateUserId(null)
      toast.success(tr("Роль обновлена"))
    })
  }

  function openProfile(contactUserId: number) {
    setSelectedProfile(null)
    setIsProfileLoading(true)

    void fetch(`/api/contacts/${contactUserId}/profile`)
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(tr(data?.message ?? "Не удалось открыть профиль"))
        }

        return data as { profile: ViewedContactProfile }
      })
      .then((data) => {
        setSelectedProfile(data.profile)
      })
      .catch((error: Error) => {
        toast.error(error.message)
      })
      .finally(() => {
        setIsProfileLoading(false)
      })
  }

  function openChatWithCall(contactId: number, media: "audio" | "video") {
    router.push(`/chats?contactId=${contactId}&startCall=${media}`)
  }

  return (
    <main className="h-dvh overflow-hidden px-4 py-5 sm:px-6">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-5 pb-28">
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
                  <p className="truncate text-lg font-semibold">
                    {user.firstName} {user.lastName}
                  </p>
                  <CountryFlagBadge phone={user.phone} />
                  <AccountStatusBadge
                    role={user.role}
                    email={user.email}
                    firstName={user.firstName}
                    lastName={user.lastName}
                  />
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {tr("Люди, с которыми вы можете начать диалог")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
        </header>

        <Card className="flex min-h-0 flex-1 flex-col border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
          <CardHeader className="border-b border-border/55 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl font-semibold tracking-tight">{tr("Контакты")}</CardTitle>
                <CardDescription>
                  {tr("Поиск пользователей по имени или телефону и добавление в свои контакты.")}
                </CardDescription>
                {canManageRoles && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {tr(
                      "Администратор может назначать базовый, премиум и developer-статус пользователям."
                    )}
                  </p>
                )}
              </div>
              <Button variant="outline" onClick={() => router.push("/blacklist")}>
                {tr("Открыть чёрный список")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden pt-6">
            <ContactProfileCard
              profile={selectedProfile}
              isLoading={isProfileLoading}
              onClose={() => {
                setSelectedProfile(null)
                setIsProfileLoading(false)
              }}
              onOpenChat={(contactId) => router.push(`/chats?contactId=${contactId}`)}
              onStartAudioCall={(contactId) => openChatWithCall(contactId, "audio")}
              onStartVideoCall={(contactId) => openChatWithCall(contactId, "video")}
            />

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
                        className="flex flex-col gap-3 rounded-[1.35rem] border border-border/70 bg-background/72 p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium">
                              {item.firstName} {item.lastName}
                            </p>
                            <CountryFlagBadge phone={item.phone} />
                            <AccountStatusBadge
                              role={item.role}
                              email={item.email}
                              firstName={item.firstName}
                              lastName={item.lastName}
                              isBlocked={item.isBlocked}
                            />
                          </div>
                          <p className="truncate text-sm text-muted-foreground">
                            {item.phone} · {item.email}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            disabled={isPending}
                            onClick={() => openProfile(item.id)}
                          >
                            {tr("Профиль")}
                          </Button>
                          <Button
                            variant={item.isAlreadyContact ? "secondary" : "default"}
                            disabled={item.isAlreadyContact || isPending}
                            onClick={() => addContact(item.id)}
                          >
                            {item.isAlreadyContact ? tr("Добавлен") : tr("Добавить")}
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
                            {item.isBlacklisted ? tr("Убрать из ЧС") : tr("В ЧС")}
                          </Button>
                        </div>
                        {canManageRoles && item.id !== user.id && (
                          <div className="w-full rounded-[1.1rem] border border-border/70 bg-card/70 p-2.5">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                              {tr("Управление ролями")}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {managedRoleButtons.map((roleOption) => (
                                <Button
                                  key={roleOption.role}
                                  size="sm"
                                  variant={item.role === roleOption.role ? "secondary" : "outline"}
                                  disabled={isPending || roleUpdateUserId === item.id}
                                  onClick={() => updateUserRole(item.id, roleOption.role)}
                                >
                                  {roleUpdateUserId === item.id
                                    ? tr("Обновляем...")
                                    : tr(roleOption.labelKey)}
                                </Button>
                              ))}
                              <Button
                                size="sm"
                                variant={item.isBlocked ? "secondary" : "destructive"}
                                disabled={isPending || roleUpdateUserId === item.id}
                                onClick={() => updateUserBlockedState(item.id, !item.isBlocked)}
                              >
                                {roleUpdateUserId === item.id
                                  ? tr("Обновляем...")
                                  : tr(
                                      item.isBlocked
                                        ? "Разблокировать аккаунт"
                                        : "Заблокировать аккаунт"
                                    )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{tr("Мои контакты")}</h3>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {contacts.length === 0 && (
                  <p className="text-sm text-muted-foreground">{tr("Контактов пока нет.")}</p>
                )}
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between gap-3 rounded-[1.35rem] border border-border/70 bg-background/72 p-3.5 transition-colors hover:bg-accent/50"
                  >
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => router.push(`/chats?contactId=${contact.id}`)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {contact.firstName} {contact.lastName}
                        </p>
                        <CountryFlagBadge phone={contact.phone} />
                        <AccountStatusBadge
                          role={contact.role}
                          email={contact.email}
                          firstName={contact.firstName}
                          lastName={contact.lastName}
                          isBlocked={contact.isBlocked}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {contact.phone} · {contact.email}
                      </p>
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openProfile(contact.id)}
                      disabled={isPending}
                    >
                      {tr("Профиль")}
                    </Button>
                    <div className="relative">
                      <button
                        type="button"
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={tr("Действия с контактом")}
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
                        <div className="absolute right-0 top-11 z-20 min-w-44 rounded-2xl border border-border bg-popover/96 p-1.5 shadow-xl backdrop-blur-xl">
                          <button
                            type="button"
                            className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => removeContact(contact.id)}
                            disabled={isPending}
                          >
                            {tr("Удалить контакт")}
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
                              ? tr("Убрать из ЧС")
                              : tr("Добавить в ЧС")}
                          </button>
                          {canManageRoles && contact.id !== user.id && (
                            <>
                              <div className="my-1 h-px bg-border/70" />
                              <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                {tr("Роли пользователей")}
                              </p>
                              {managedRoleButtons.map((roleOption) => (
                                <button
                                  key={roleOption.role}
                                  type="button"
                                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                                  onClick={() => updateUserRole(contact.id, roleOption.role)}
                                  disabled={isPending || roleUpdateUserId === contact.id}
                                >
                                  {roleUpdateUserId === contact.id
                                    ? tr("Обновляем...")
                                    : tr(roleOption.labelKey)}
                                </button>
                              ))}
                              <button
                                type="button"
                                className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() =>
                                  updateUserBlockedState(contact.id, !contact.isBlocked)
                                }
                                disabled={isPending || roleUpdateUserId === contact.id}
                              >
                                {roleUpdateUserId === contact.id
                                  ? tr("Обновляем...")
                                  : tr(
                                      contact.isBlocked
                                        ? "Разблокировать аккаунт"
                                        : "Заблокировать аккаунт"
                                    )}
                              </button>
                            </>
                          )}
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
