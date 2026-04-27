"use client"

import { HeartIcon, MessageSquareIcon, SendIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { AccountStatusBadge } from "@/components/ui/account-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  const [posts, setPosts] = useState(initialPosts)
  const [postText, setPostText] = useState("")
  const [commentTextByPostId, setCommentTextByPostId] = useState<Record<number, string>>({})
  const [expandedPostIds, setExpandedPostIds] = useState<Record<number, boolean>>({})
  const [isPosting, startPosting] = useTransition()
  const [isLiking, startLiking] = useTransition()
  const [isCommenting, startCommenting] = useTransition()
  const emblem = buildEmblem(user.firstName, user.lastName)
  const emblemTone = getEmblemTone(user.firstName, user.lastName)

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

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6 pb-28">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
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
                  {user.firstName} {user.lastName ?? ""}
                </p>
                <AccountStatusBadge role={user.role} email={user.email} />
              </div>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PushToggle />
            <LanguageToggle />
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>

        <Card className="border-border/80 shadow-xl shadow-black/5">
          <CardHeader>
            <CardTitle className="text-2xl">Лента новостей</CardTitle>
            <CardDescription>
              Публикуйте текстовые заметки, ставьте лайки и обсуждайте новости в комментариях.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-xl border border-border/70 p-4">
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
                  <div key={post.id} className="rounded-xl border border-border/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            {post.author.firstName} {post.author.lastName ?? ""}
                          </p>
                          <AccountStatusBadge role={post.author.role} email={post.author.email} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(post.createdAt).toLocaleString("ru-RU")}
                        </p>
                      </div>
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
                            <div key={comment.id} className="rounded-lg bg-muted/40 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">
                                  {comment.author.firstName} {comment.author.lastName ?? ""}
                                </p>
                                <AccountStatusBadge
                                  role={comment.author.role}
                                  email={comment.author.email}
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
