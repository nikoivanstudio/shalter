"use client"

import { EllipsisVerticalIcon, HeartIcon, MessageSquareIcon, SendIcon } from "lucide-react"
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

export function FeedHome({
  user,
  posts: initialPosts,
}: {
  user: FeedUser
  posts: FeedPost[]
}) {
  const { tr } = useI18n()
  const [posts, setPosts] = useState(initialPosts)
  const [postText, setPostText] = useState("")
  const [commentTextByPostId, setCommentTextByPostId] = useState<Record<number, string>>({})
  const [expandedPostIds, setExpandedPostIds] = useState<Record<number, boolean>>({})
  const [isPosting, startPosting] = useTransition()
  const [isLiking, startLiking] = useTransition()
  const [isCommenting, startCommenting] = useTransition()
  const [isDeletingPost, startDeletingPost] = useTransition()
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
                <p className="truncate text-sm text-muted-foreground">Новости и обновления от сообщества</p>
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
            <CardTitle className="text-2xl font-semibold tracking-tight">Лента новостей</CardTitle>
            <CardDescription>
              Публикуйте текстовые заметки, ставьте лайки и обсуждайте новости в комментариях.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
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
          </CardContent>
        </Card>
      </div>

      <BottomNav active="feed" />
    </main>
  )
}
