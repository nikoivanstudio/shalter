"use client"

import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  GiftIcon,
  MessageCircleIcon,
  PhoneCallIcon,
  VideoIcon,
} from "lucide-react"

import { AccountStatusBadge } from "@/components/ui/account-status-badge"
import { Button } from "@/components/ui/button"
import type { ViewedContactProfile } from "@/features/contacts/lib/viewed-profile"
import { giftCatalog } from "@/shared/lib/rewards/catalog"
import { CountryFlagBadge } from "@/shared/ui/country-flag-badge"
import { UserAvatar } from "@/shared/ui/user-avatar"

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
      {label}: <span className="font-medium text-foreground">{value}</span>
    </span>
  )
}

export function ViewedProfilePage({ profile }: { profile: ViewedContactProfile }) {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.1),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.88))] px-4 py-5 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))] sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 py-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[1.7rem] border border-border/70 bg-card/86 px-4 py-3 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.34)] backdrop-blur-xl">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Публичный профиль
            </p>
            <h1 className="mt-1 text-xl font-semibold">
              {profile.firstName} {profile.lastName ?? ""}
            </h1>
          </div>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            <ArrowLeftIcon className="size-4" />
            Назад
          </Button>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <div className="space-y-4">
            <div className="rounded-[1.8rem] border border-border/70 bg-card/88 p-5 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.4)] backdrop-blur-xl">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <UserAvatar
                  firstName={profile.firstName}
                  lastName={profile.lastName}
                  avatarTone={profile.avatarTone}
                  avatarUrl={profile.avatarUrl}
                  className="size-24 border border-border/70"
                  textClassName="text-2xl font-semibold"
                />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-2xl font-semibold">
                      {profile.firstName} {profile.lastName ?? ""}
                    </p>
                    <CountryFlagBadge phone={profile.phone} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AccountStatusBadge
                      role={profile.role}
                      email={profile.email}
                      firstName={profile.firstName}
                      lastName={profile.lastName}
                      isBlocked={profile.isBlocked}
                    />
                    {profile.phone ? (
                      <span className="text-sm text-muted-foreground">{profile.phone}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Телефон скрыт</span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>@{profile.username}</p>
                    <p className="break-all">{profile.email ?? "Email скрыт"}</p>
                    <p>В сервисе с {new Date(profile.createdAt).toLocaleDateString("ru-RU")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatPill label="Подарков" value={String(profile.gifts.length)} />
                    <StatPill
                      label="Партнерские звезды"
                      value={String(profile.partnerStarsEarned)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-border/70 bg-card/88 p-5 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.34)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Полученные подарки</h2>
                  <p className="text-sm text-muted-foreground">
                    Последние награды и подарки пользователя.
                  </p>
                </div>
                <GiftIcon className="size-5 text-primary" />
              </div>

              {!profile.giftsVisible ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Пользователь скрыл подарки в настройках приватности.
                </p>
              ) : profile.gifts.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Пока нет полученных подарков.
                </p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {profile.gifts.map((gift) => {
                    const giftMeta = giftCatalog.find((item) => item.key === gift.giftKey)

                    return (
                      <article
                        key={gift.id}
                        className="overflow-hidden rounded-[1.3rem] border border-border/70 bg-background/90"
                      >
                        {giftMeta?.imageUrl ? (
                          <img
                            src={giftMeta.imageUrl}
                            alt={gift.giftName}
                            className="h-36 w-full object-cover"
                          />
                        ) : null}
                        <div className="space-y-2 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-medium">{gift.giftName}</p>
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                              {gift.starsSpent} зв.
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {gift.sender
                              ? `От ${gift.sender.firstName} ${gift.sender.lastName ?? ""}`.trim()
                              : "Подарок без отправителя"}
                          </p>
                          {gift.note ? (
                            <p className="text-sm text-muted-foreground">{gift.note}</p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {new Date(gift.createdAt).toLocaleString("ru-RU")}
                          </p>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[1.8rem] border border-border/70 bg-card/88 p-5 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.34)] backdrop-blur-xl">
              <h2 className="text-lg font-semibold">Действия</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Быстрый переход к общению и звонкам.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button type="button" onClick={() => router.push(`/chats?contactId=${profile.id}`)}>
                  <MessageCircleIcon className="size-4" />
                  Открыть чат
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => location.assign(`/chats?contactId=${profile.id}&startCall=audio`)}
                >
                  <PhoneCallIcon className="size-4" />
                  Аудиозвонок
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => location.assign(`/chats?contactId=${profile.id}&startCall=video`)}
                >
                  <VideoIcon className="size-4" />
                  Видеозвонок
                </Button>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-border/70 bg-card/88 p-5 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.34)] backdrop-blur-xl">
              <h2 className="text-lg font-semibold">О профиле</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-[1rem] border border-border/70 bg-background/80 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Username
                  </p>
                  <p className="mt-1 font-medium">@{profile.username}</p>
                </div>
                <div className="rounded-[1rem] border border-border/70 bg-background/80 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Email
                  </p>
                  <p className="mt-1 break-all font-medium">
                    {profile.email ?? "Скрыт настройками приватности"}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-border/70 bg-background/80 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Телефон
                  </p>
                  <p className="mt-1 font-medium">
                    {profile.phone ?? "Скрыт настройками приватности"}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}
