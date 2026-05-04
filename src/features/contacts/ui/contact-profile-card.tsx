"use client"

import {
  GiftIcon,
  MessageCircleIcon,
  PhoneCallIcon,
  VideoIcon,
  XIcon,
} from "lucide-react"

import { AccountStatusBadge } from "@/components/ui/account-status-badge"
import { Button } from "@/components/ui/button"
import { giftCatalog } from "@/shared/lib/rewards/catalog"
import { CountryFlagBadge } from "@/shared/ui/country-flag-badge"
import { UserAvatar } from "@/shared/ui/user-avatar"

type ProfileGift = {
  id: number
  giftKey: string
  giftName: string
  starsSpent: number
  note: string | null
  createdAt: string
  sender: {
    id: number
    firstName: string
    lastName: string | null
  } | null
}

export type ViewedContactProfile = {
  id: number
  email: string | null
  firstName: string
  lastName: string | null
  phone: string | null
  role: string
  avatarTone: string | null
  avatarUrl: string | null
  isBlocked: boolean
  starsBalance: number
  partnerStarsEarned: number
  createdAt: string
  giftsVisible: boolean
  gifts: ProfileGift[]
}

export function ContactProfileCard({
  profile,
  isLoading,
  onClose,
  onOpenChat,
  onStartAudioCall,
  onStartVideoCall,
}: {
  profile: ViewedContactProfile | null
  isLoading: boolean
  onClose: () => void
  onOpenChat: (contactId: number) => void
  onStartAudioCall?: (contactId: number) => void
  onStartVideoCall?: (contactId: number) => void
}) {
  if (!profile && !isLoading) {
    return null
  }

  return (
    <div className="flex max-h-[min(72dvh,42rem)] min-h-0 flex-col overflow-hidden rounded-[1.7rem] border border-border/70 bg-card/88 p-4 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Просмотр профиля
          </p>
          <h3 className="mt-1 text-xl font-semibold">
            {isLoading ? "Загружаем..." : `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim()}
          </h3>
        </div>
        <Button type="button" size="icon" variant="outline" onClick={onClose}>
          <XIcon className="size-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          <p className="text-sm text-muted-foreground">
            Собираем подарки и данные профиля...
          </p>
        </div>
      ) : profile ? (
        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <UserAvatar
              firstName={profile.firstName}
              lastName={profile.lastName}
              avatarTone={profile.avatarTone}
              avatarUrl={profile.avatarUrl}
              className="size-20 border border-border/70"
              textClassName="text-xl font-semibold"
            />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold">
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
              <p className="break-all text-sm text-muted-foreground">
                {profile.email ?? "Email скрыт"}
              </p>
              <p className="text-sm text-muted-foreground">
                В сервисе с {new Date(profile.createdAt).toLocaleDateString("ru-RU")}
              </p>
              <div className="flex flex-wrap gap-2">
                <BadgeStat label="Подарков" value={String(profile.gifts.length)} />
                <BadgeStat
                  label="Партнёрские звёзды"
                  value={String(profile.partnerStarsEarned)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-border/70 bg-background/72 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Полученные подарки</p>
                <p className="text-xs text-muted-foreground">
                  Видно последние подарки, которые получил пользователь.
                </p>
              </div>
              <GiftIcon className="size-5 text-primary" />
            </div>

            {!profile.giftsVisible ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Пользователь скрыл подарки в настройках приватности.
              </p>
            ) : profile.gifts.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Пока нет полученных подарков.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {profile.gifts.map((gift) => {
                  const giftMeta = giftCatalog.find((item) => item.key === gift.giftKey)

                  return (
                    <div
                      key={gift.id}
                      className="overflow-hidden rounded-[1.2rem] border border-border/70 bg-background/90"
                    >
                      {giftMeta?.imageUrl ? (
                        <img
                          src={giftMeta.imageUrl}
                          alt={gift.giftName}
                          className="h-32 w-full object-cover"
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
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => onOpenChat(profile.id)}>
              <MessageCircleIcon className="size-4" />
              Открыть чат
            </Button>
            {onStartAudioCall ? (
              <Button type="button" variant="outline" onClick={() => onStartAudioCall(profile.id)}>
                <PhoneCallIcon className="size-4" />
                Аудио
              </Button>
            ) : null}
            {onStartVideoCall ? (
              <Button type="button" variant="outline" onClick={() => onStartVideoCall(profile.id)}>
                <VideoIcon className="size-4" />
                Видео
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function BadgeStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
      {label}: <span className="font-medium text-foreground">{value}</span>
    </span>
  )
}
