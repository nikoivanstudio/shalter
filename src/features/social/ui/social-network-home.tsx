"use client"

import {
  ArrowRightIcon,
  CompassIcon,
  MessageCircleIcon,
  RadioTowerIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { MessageAttachmentView } from "@/shared/ui/message-attachment-view"
import { UserAvatar } from "@/shared/ui/user-avatar"
import type { MediaAttachment } from "@/shared/lib/media/constants"

type SocialUser = {
  id: number
  firstName: string
  lastName: string | null
  email: string
  role: string
  avatarTone: string | null
  avatarUrl?: string | null
}

type SocialTopic = {
  tag: string
  count: number
}

type SocialCreator = SocialUser & {
  postsCount: number
  communitiesCount: number
}

type SocialCommunity = {
  id: number
  title: string
  username: string
  description: string | null
  avatarUrl: string | null
  participantsCount: number
  messagesCount: number
  owner: {
    id: number
    firstName: string
    lastName: string | null
    avatarTone: string | null
    avatarUrl: string | null
  }
}

type SocialComment = {
  id: number
  content: string
  createdAt: string
  author: SocialUser
}

type SocialPost = {
  id: number
  content: string
  createdAt: string
  author: SocialUser
  attachment: MediaAttachment[]
  likesCount: number
  commentsCount: number
  commentsPreview: SocialComment[]
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function formatRelativeDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function buildDisplayName(user: {
  firstName: string
  lastName: string | null
}) {
  return `${user.firstName} ${user.lastName ?? ""}`.trim()
}

export function SocialNetworkHome({
  currentUser,
  stats,
  trendingTopics,
  featuredCreators,
  communities,
  feed,
}: {
  currentUser: SocialUser
  stats: {
    usersCount: number
    postsCount: number
    channelsCount: number
    contactsCount: number
  }
  trendingTopics: SocialTopic[]
  featuredCreators: SocialCreator[]
  communities: SocialCommunity[]
  feed: SocialPost[]
}) {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.16),transparent_26%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_24%),linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.92))] px-4 py-5 pb-16 dark:bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_22%),linear-gradient(180deg,rgba(17,24,39,0.98),rgba(3,7,18,0.98))] sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-5rem] top-8 h-52 w-52 rounded-full bg-pink-300/20 blur-3xl dark:bg-pink-400/16" />
        <div className="absolute right-[-4rem] top-20 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-400/14" />
        <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(255,255,255,0.45),transparent)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)]" />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-[0_30px_80px_-48px_rgba(17,24,39,0.5)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/6 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-pink-200/70 bg-pink-500/10 px-3 py-1 text-sm font-medium text-pink-700 dark:border-pink-400/20 dark:text-pink-200">
                <SparklesIcon className="size-4" />
                Новый проект: social network на базе текущего мессенджера
              </div>

              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                  Shalter Pulse объединяет ленту, сообщества, создателей и быстрый переход в чаты.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                  Это отдельный social-хаб поверх существующего проекта: люди публикуют посты, находят
                  комьюнити, следят за трендами и уходят в личные сообщения, когда нужно продолжить разговор.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/feed"
                  className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}
                >
                  Открыть полную ленту
                  <ArrowRightIcon className="size-4" />
                </Link>
                <Link
                  href="/channels"
                  className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full px-6")}
                >
                  Перейти в сообщества
                </Link>
                <Link
                  href="/chats"
                  className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full px-6")}
                >
                  Открыть сообщения
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Участники" value={formatCompactNumber(stats.usersCount)} />
                <StatCard label="Публикации" value={formatCompactNumber(stats.postsCount)} />
                <StatCard label="Сообщества" value={formatCompactNumber(stats.channelsCount)} />
                <StatCard label="Ваши контакты" value={formatCompactNumber(stats.contactsCount)} />
              </div>
            </div>

            <Card className="border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,244,230,0.7))] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.82),rgba(15,23,42,0.76))]">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    firstName={currentUser.firstName}
                    lastName={currentUser.lastName}
                    avatarTone={currentUser.avatarTone}
                    avatarUrl={currentUser.avatarUrl}
                    className="size-14"
                  />
                  <div>
                    <p className="text-lg font-semibold">{buildDisplayName(currentUser)}</p>
                    <p className="text-sm text-muted-foreground">Ваш social cockpit готов к запуску</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <QuickLink
                    href="/"
                    icon={<CompassIcon className="size-4" />}
                    title="Профиль и настройки"
                    description="Оформить личную страницу и приватность."
                  />
                  <QuickLink
                    href="/contacts"
                    icon={<UsersIcon className="size-4" />}
                    title="Люди и связи"
                    description="Найти знакомых и расширить сеть."
                  />
                  <QuickLink
                    href="/channels"
                    icon={<RadioTowerIcon className="size-4" />}
                    title="Комьюнити"
                    description="Запустить свой канал или вступить в существующий."
                  />
                  <QuickLink
                    href="/chats"
                    icon={<MessageCircleIcon className="size-4" />}
                    title="Мгновенные диалоги"
                    description="Перевести любое обсуждение в личку."
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="space-y-6">
            <SectionTitle
              eyebrow="Лента"
              title="Живая social-лента"
              description="Показывает реальные публикации из проекта и подчёркивает медиаконтент, реакции и обсуждения."
            />

            <div className="space-y-4">
              {feed.map((post) => (
                <article
                  key={post.id}
                  className="rounded-[1.8rem] border border-white/55 bg-white/78 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        firstName={post.author.firstName}
                        lastName={post.author.lastName}
                        avatarTone={post.author.avatarTone}
                        avatarUrl={post.author.avatarUrl}
                        className="size-12"
                      />
                      <div>
                        <p className="font-semibold">{buildDisplayName(post.author)}</p>
                        <p className="text-sm text-muted-foreground">{formatRelativeDate(post.createdAt)}</p>
                      </div>
                    </div>

                    <Link
                      href="/feed"
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-full")}
                    >
                      Подробнее
                    </Link>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">
                    {post.content}
                  </p>

                  {post.attachment.length > 0 ? (
                    <div className="mt-4 overflow-hidden rounded-[1.4rem] border border-border/60 bg-background/70 p-3">
                      <MessageAttachmentView attachment={post.attachment} />
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <SocialPill label="лайков" value={post.likesCount} />
                    <SocialPill label="комментариев" value={post.commentsCount} />
                  </div>

                  {post.commentsPreview.length > 0 ? (
                    <div className="mt-4 space-y-3 border-t border-border/70 pt-4">
                      {post.commentsPreview.map((comment) => (
                        <div
                          key={comment.id}
                          className="rounded-[1.2rem] border border-border/60 bg-background/75 p-3"
                        >
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              firstName={comment.author.firstName}
                              lastName={comment.author.lastName}
                              avatarTone={comment.author.avatarTone}
                              avatarUrl={comment.author.avatarUrl}
                              className="size-8"
                              textClassName="text-[10px] font-semibold"
                            />
                            <p className="text-sm font-medium">{buildDisplayName(comment.author)}</p>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <Card className="border-white/55 bg-white/76 backdrop-blur-xl dark:border-white/10 dark:bg-white/6">
              <CardContent className="p-5">
                <SectionTitle
                  eyebrow="Тренды"
                  title="Темы дня"
                  description="Хэштеги собраны из последних постов, чтобы лента ощущалась как настоящая соцсеть."
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {trendingTopics.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Пока нет популярных тегов, но лента уже готова к росту.</p>
                  ) : (
                    trendingTopics.map((topic) => (
                      <div
                        key={topic.tag}
                        className="rounded-full border border-pink-200/70 bg-pink-500/8 px-3 py-2 text-sm dark:border-pink-400/20"
                      >
                        <span className="font-medium">{topic.tag}</span>
                        <span className="ml-2 text-muted-foreground">{topic.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/55 bg-white/76 backdrop-blur-xl dark:border-white/10 dark:bg-white/6">
              <CardContent className="p-5">
                <SectionTitle
                  eyebrow="Creators"
                  title="Кого уже можно продвигать"
                  description="Авторы с активной публикацией контента могут стать ядром новой соцсети."
                />
                <div className="mt-4 space-y-3">
                  {featuredCreators.map((creator) => (
                    <div
                      key={creator.id}
                      className="rounded-[1.3rem] border border-border/60 bg-background/75 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          firstName={creator.firstName}
                          lastName={creator.lastName}
                          avatarTone={creator.avatarTone}
                          avatarUrl={creator.avatarUrl}
                          className="size-11"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{buildDisplayName(creator)}</p>
                          <p className="text-sm text-muted-foreground">
                            {creator.postsCount} постов • {creator.communitiesCount} сообществ
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/55 bg-white/76 backdrop-blur-xl dark:border-white/10 dark:bg-white/6">
              <CardContent className="p-5">
                <SectionTitle
                  eyebrow="Комьюнити"
                  title="Сообщества для роста"
                  description="Каналы превращаются в витрину интересов и точку входа для новых участников."
                />
                <div className="mt-4 space-y-3">
                  {communities.map((community) => (
                    <div
                      key={community.id}
                      className="rounded-[1.3rem] border border-border/60 bg-background/75 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{community.title}</p>
                          <p className="text-sm text-muted-foreground">@{community.username}</p>
                        </div>
                        <Link
                          href="/channels"
                          className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}
                        >
                          Открыть
                        </Link>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {community.description?.trim() || "Сообщество уже готово к наполнению и развитию контента."}
                      </p>
                      <div className="mt-4 flex items-center gap-3">
                        <UserAvatar
                          firstName={community.owner.firstName}
                          lastName={community.owner.lastName}
                          avatarTone={community.owner.avatarTone}
                          avatarUrl={community.owner.avatarUrl}
                          className="size-9"
                          textClassName="text-xs font-semibold"
                        />
                        <div className="text-sm text-muted-foreground">
                          {community.participantsCount} участников • {community.messagesCount} сообщений
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  )
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-pink-600 dark:text-pink-300">
        {eyebrow}
      </p>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-white/60 bg-white/72 px-4 py-4 dark:border-white/10 dark:bg-white/7">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function SocialPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-full border border-border/70 bg-background/75 px-3 py-1.5 text-sm">
      <span className="font-medium">{value}</span>
      <span className="ml-1 text-muted-foreground">{label}</span>
    </div>
  )
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-[1.3rem] border border-border/60 bg-background/72 p-3 transition hover:bg-background"
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
      </span>
    </Link>
  )
}
