"use client"

import {
  EllipsisVerticalIcon,
  HeartIcon,
  LayoutPanelTopIcon,
  MessageSquareIcon,
  MegaphoneIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { AccountStatusBadge } from "@/components/ui/account-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import type { AdCampaign } from "@/features/ads/lib/store"
import { useI18n } from "@/features/i18n/model/i18n-provider"
import { LanguageToggle } from "@/features/i18n/ui/language-toggle"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { PushToggle } from "@/features/notifications/ui/push-toggle"
import { buildEmblem, getEmblemTone } from "@/features/profile/lib/emblem"
import { ThemeToggle } from "@/features/theme/ui/theme-toggle"
import { LogoutButton } from "@/features/auth/ui/logout-button"

type FeedUser = {
  id: number
  firstName: string
  lastName: string | null
  email: string
  role: string
  avatarTone: string | null
  isBlocked?: boolean
}

type FeedComment = {
  id: number
  content: string
  createdAt: string
  author: FeedUser
}

type FeedPost = {
  id: number
  content: string
  createdAt: string
  author: FeedUser
  likesCount: number
  likedByMe: boolean
  comments: FeedComment[]
}

type FeedTab = "news" | "ads" | "cabinet"

export function FeedHome({
  user,
  posts: initialPosts,
  ads: initialAds,
  myAds: initialMyAds,
}: {
  user: FeedUser
  posts: FeedPost[]
  ads: AdCampaign[]
  myAds: AdCampaign[]
}) {
  const { tr } = useI18n()
  const [activeTab, setActiveTab] = useState<FeedTab>("news")
  const [posts, setPosts] = useState(initialPosts)
  const [ads, setAds] = useState(initialAds)
  const [myAds, setMyAds] = useState(initialMyAds)
  const [postText, setPostText] = useState("")
  const [commentTextByPostId, setCommentTextByPostId] = useState<Record<number, string>>({})
  const [expandedPostIds, setExpandedPostIds] = useState<Record<number, boolean>>({})
  const [adTitle, setAdTitle] = useState("")
  const [adDescription, setAdDescription] = useState("")
  const [adCtaText, setAdCtaText] = useState("Открыть")
  const [adTargetUrl, setAdTargetUrl] = useState("")
  const [adAudience, setAdAudience] = useState<AdCampaign["audience"]>("all")
  const [adBudget, setAdBudget] = useState("1000")
  const [isPosting, startPosting] = useTransition()
  const [isLiking, startLiking] = useTransition()
  const [isCommenting, startCommenting] = useTransition()
  const [isDeletingPost, startDeletingPost] = useTransition()
  const [isSubmittingAd, startSubmittingAd] = useTransition()
  const [isUpdatingAd, startUpdatingAd] = useTransition()
  const emblem = buildEmblem(user.firstName, user.lastName)
  const emblemTone = getEmblemTone(user.firstName, user.lastName, user.avatarTone)

  function createPost() {
    startPosting(async () => {
      const response = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: postText }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось опубликовать пост")
        return
      }

      setPosts((prev) => [data.post as FeedPost, ...prev])
      setPostText("")
      toast.success("Публикация создана")
    })
  }

  function toggleLike(postId: number) {
    startLiking(async () => {
      const response = await fetch(`/api/feed/${postId}/likes`, {
        method: "POST",
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось обновить лайк")
        return
      }

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                likedByMe: Boolean(data?.likedByMe),
                likesCount: Number(data?.likesCount ?? post.likesCount),
              }
            : post
        )
      )
    })
  }

  function addComment(postId: number) {
    startCommenting(async () => {
      const response = await fetch(`/api/feed/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentTextByPostId[postId] ?? "" }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось добавить комментарий")
        return
      }

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: [...post.comments, data.comment as FeedComment],
              }
            : post
        )
      )
      setCommentTextByPostId((prev) => ({ ...prev, [postId]: "" }))
      setExpandedPostIds((prev) => ({ ...prev, [postId]: true }))
      toast.success("Комментарий добавлен")
    })
  }

  function removePost(postId: number) {
    startDeletingPost(async () => {
      const response = await fetch(`/api/feed/${postId}`, {
        method: "DELETE",
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(tr(data?.message ?? "Не удалось удалить публикацию"))
        return
      }

      setPosts((prev) => prev.filter((post) => post.id !== postId))
      toast.success(tr("Публикация удалена"))
    })
  }

  function submitAdCampaign() {
    startSubmittingAd(async () => {
      const response = await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: adTitle,
          description: adDescription,
          ctaText: adCtaText,
          targetUrl: adTargetUrl,
          audience: adAudience,
          budget: Number(adBudget),
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось создать размещение")
        return
      }

      const campaign = data.campaign as AdCampaign
      setMyAds((prev) => [campaign, ...prev])
      setAdTitle("")
      setAdDescription("")
      setAdCtaText("Открыть")
      setAdTargetUrl("")
      setAdAudience("all")
      setAdBudget("1000")
      setActiveTab("cabinet")
      toast.success("Рекламная кампания создана")
    })
  }

  function updateAdStatus(adId: number, status: AdCampaign["status"]) {
    startUpdatingAd(async () => {
      const response = await fetch(`/api/ads/${adId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось обновить размещение")
        return
      }

      const campaign = data.campaign as AdCampaign
      setMyAds((prev) => prev.map((item) => (item.id === adId ? campaign : item)))
      setAds((prev) => {
        const withoutCurrent = prev.filter((item) => item.id !== adId)
        return campaign.status === "active" ? [campaign, ...withoutCurrent] : withoutCurrent
      })
      toast.success(
        status === "active" ? "Размещение запущено" : status === "paused" ? "Размещение остановлено" : "Статус обновлён"
      )
    })
  }

  function deleteAd(adId: number) {
    startUpdatingAd(async () => {
      const response = await fetch(`/api/ads/${adId}`, {
        method: "DELETE",
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось удалить размещение")
        return
      }

      setMyAds((prev) => prev.filter((item) => item.id !== adId))
      setAds((prev) => prev.filter((item) => item.id !== adId))
      toast.success("Размещение удалено")
    })
  }

  function openAd(ad: AdCampaign) {
    void fetch(`/api/ads/${ad.id}/click`, { method: "POST" }).catch(() => null)
    window.open(ad.targetUrl, "_blank", "noopener,noreferrer")
    setAds((prev) =>
      prev.map((item) => (item.id === ad.id ? { ...item, clicks: item.clicks + 1 } : item))
    )
  }

  return (
    <main className="min-h-screen px-4 py-5 pb-28 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
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
                    {user.firstName} {user.lastName ?? ""}
                  </p>
                  <AccountStatusBadge
                    role={user.role}
                    email={user.email}
                    firstName={user.firstName}
                    lastName={user.lastName}
                  />
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  Новости, рекламный лист и кабинет размещения в одном окне.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PushToggle />
              <LanguageToggle />
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
        </header>

        <Card className="border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
          <CardHeader className="border-b border-border/55 pb-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  Рекламный лист и лента
                </CardTitle>
                <CardDescription>
                  Публикуйте новости, просматривайте рекламу и управляйте своими размещениями.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={activeTab === "news" ? "default" : "outline"}
                  onClick={() => setActiveTab("news")}
                >
                  <LayoutPanelTopIcon className="size-4" />
                  Новости
                </Button>
                <Button
                  type="button"
                  variant={activeTab === "ads" ? "default" : "outline"}
                  onClick={() => setActiveTab("ads")}
                >
                  <MegaphoneIcon className="size-4" />
                  Рекламный лист
                </Button>
                <Button
                  type="button"
                  variant={activeTab === "cabinet" ? "default" : "outline"}
                  onClick={() => setActiveTab("cabinet")}
                >
                  <MessageSquareIcon className="size-4" />
                  Кабинет рекламы
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            {activeTab === "news" && (
              <>
                <div className="space-y-3 rounded-[1.6rem] border border-border/70 bg-background/78 p-4 shadow-sm">
                  <Input
                    value={postText}
                    onChange={(event) => setPostText(event.target.value)}
                    placeholder="Что нового?"
                  />
                  <Button onClick={createPost} disabled={isPosting || postText.trim().length === 0}>
                    {isPosting ? "Публикуем..." : "Опубликовать"}
                  </Button>
                </div>

                <div className="space-y-4">
                  {posts.length === 0 && (
                    <p className="text-sm text-muted-foreground">Пока нет публикаций.</p>
                  )}
                  {posts.map((post) => {
                    const isExpanded = Boolean(expandedPostIds[post.id])

                    return (
                      <div
                        key={post.id}
                        className="rounded-[1.6rem] border border-border/70 bg-background/78 p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">
                                {post.author.firstName} {post.author.lastName ?? ""}
                              </p>
                              <AccountStatusBadge
                                role={post.author.role}
                                email={post.author.email}
                                firstName={post.author.firstName}
                                lastName={post.author.lastName}
                                isBlocked={post.author.isBlocked}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(post.createdAt).toLocaleString("ru-RU")}
                            </p>
                          </div>
                          {post.author.id === user.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="inline-flex size-8 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted-foreground hover:bg-accent"
                                aria-label={tr("Удалить публикацию")}
                              >
                                <EllipsisVerticalIcon className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={isDeletingPost}
                                  onClick={() => removePost(post.id)}
                                >
                                  {tr("Удалить публикацию")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>

                        <p className="mt-3 whitespace-pre-wrap text-sm">{post.content}</p>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant={post.likedByMe ? "secondary" : "outline"}
                            disabled={isLiking}
                            onClick={() => toggleLike(post.id)}
                          >
                            <HeartIcon className="size-4" />
                            {post.likesCount}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setExpandedPostIds((prev) => ({ ...prev, [post.id]: !isExpanded }))
                            }
                          >
                            <MessageSquareIcon className="size-4" />
                            {post.comments.length}
                          </Button>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 space-y-3 border-t border-border/70 pt-4">
                            <div className="space-y-3">
                              {post.comments.length === 0 && (
                                <p className="text-sm text-muted-foreground">Комментариев пока нет.</p>
                              )}
                              {post.comments.map((comment) => (
                                <div key={comment.id} className="rounded-[1.15rem] bg-muted/55 p-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium">
                                      {comment.author.firstName} {comment.author.lastName ?? ""}
                                    </p>
                                    <AccountStatusBadge
                                      role={comment.author.role}
                                      email={comment.author.email}
                                      firstName={comment.author.firstName}
                                      lastName={comment.author.lastName}
                                      isBlocked={comment.author.isBlocked}
                                    />
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
                                </div>
                              ))}
                            </div>

                            <div className="flex gap-2">
                              <Input
                                value={commentTextByPostId[post.id] ?? ""}
                                onChange={(event) =>
                                  setCommentTextByPostId((prev) => ({
                                    ...prev,
                                    [post.id]: event.target.value,
                                  }))
                                }
                                placeholder="Добавить комментарий"
                              />
                              <Button
                                size="icon"
                                disabled={isCommenting || !(commentTextByPostId[post.id] ?? "").trim()}
                                onClick={() => addComment(post.id)}
                              >
                                <SendIcon className="size-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {activeTab === "ads" && (
              <div className="grid gap-4 lg:grid-cols-2">
                {ads.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Активных рекламных размещений пока нет.</p>
                ) : (
                  ads.map((ad) => (
                    <div
                      key={ad.id}
                      className="rounded-[1.6rem] border border-border/70 bg-background/78 p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">{ad.title}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            {ad.audience === "all"
                              ? "Для всех"
                              : ad.audience === "client"
                                ? "Для клиентов"
                                : "Для пользователей"}
                          </p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          {ad.budget} ₽
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{ad.description}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <AccountStatusBadge
                          role={ad.owner.role}
                          email={ad.owner.email}
                          firstName={ad.owner.firstName}
                          lastName={ad.owner.lastName}
                          isBlocked={ad.owner.isBlocked}
                        />
                        <span className="text-xs text-muted-foreground">
                          {ad.owner.firstName} {ad.owner.lastName ?? ""}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">Клики: {ad.clicks}</p>
                        <Button type="button" onClick={() => openAd(ad)}>
                          <MegaphoneIcon className="size-4" />
                          {ad.ctaText}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "cabinet" && (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle className="text-base">Новое размещение</CardTitle>
                    <CardDescription>
                      Создайте рекламную кампанию, затем запустите её из личного кабинета.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="ad-title">
                        Заголовок
                      </label>
                      <Input id="ad-title" value={adTitle} onChange={(event) => setAdTitle(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="ad-description">
                        Описание
                      </label>
                      <textarea
                        id="ad-description"
                        value={adDescription}
                        onChange={(event) => setAdDescription(event.target.value)}
                        className="min-h-28 w-full rounded-[1.1rem] border border-input bg-input/85 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="ad-cta">
                          Кнопка
                        </label>
                        <Input id="ad-cta" value={adCtaText} onChange={(event) => setAdCtaText(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="ad-budget">
                          Бюджет
                        </label>
                        <Input
                          id="ad-budget"
                          inputMode="numeric"
                          value={adBudget}
                          onChange={(event) => setAdBudget(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="ad-url">
                        Ссылка
                      </label>
                      <Input id="ad-url" value={adTargetUrl} onChange={(event) => setAdTargetUrl(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Аудитория</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: "all", label: "Все" },
                          { value: "client", label: "Клиенты" },
                          { value: "user", label: "Пользователи" },
                        ].map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            variant={adAudience === option.value ? "default" : "outline"}
                            onClick={() => setAdAudience(option.value as AdCampaign["audience"])}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Button type="button" onClick={submitAdCampaign} disabled={isSubmittingAd}>
                      {isSubmittingAd ? "Создаём..." : "Добавить размещение"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle className="text-base">Мой рекламный кабинет</CardTitle>
                    <CardDescription>
                      Запускайте, останавливайте и удаляйте свои размещения.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {myAds.length === 0 ? (
                      <p className="text-sm text-muted-foreground">У вас пока нет рекламных кампаний.</p>
                    ) : (
                      myAds.map((ad) => (
                        <div key={ad.id} className="rounded-[1.4rem] border border-border/70 bg-background/78 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-base font-semibold">{ad.title}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{ad.description}</p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                ad.status === "active"
                                  ? "bg-primary/10 text-primary"
                                  : ad.status === "paused"
                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {ad.status === "active"
                                ? "Активно"
                                : ad.status === "paused"
                                  ? "Пауза"
                                  : "Черновик"}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                            <p>Бюджет: {ad.budget} ₽</p>
                            <p>Клики: {ad.clicks}</p>
                            <p>Показы: {ad.impressions}</p>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {ad.status !== "active" ? (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => updateAdStatus(ad.id, "active")}
                                disabled={isUpdatingAd}
                              >
                                <PlayCircleIcon className="size-4" />
                                Запустить
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => updateAdStatus(ad.id, "paused")}
                                disabled={isUpdatingAd}
                              >
                                <PauseCircleIcon className="size-4" />
                                Остановить
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteAd(ad.id)}
                              disabled={isUpdatingAd}
                            >
                              <Trash2Icon className="size-4" />
                              Удалить
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <BottomNav active="feed" />
    </main>
  )
}
