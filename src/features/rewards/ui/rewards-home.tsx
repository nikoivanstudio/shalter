"use client"

import { CoinsIcon, GemIcon, SendIcon, TrendingUpIcon } from "lucide-react"
import Image from "next/image"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { hasAdministrativeAccess } from "@/shared/lib/auth/roles"
import {
  cryptoGiftCatalog,
  giftCatalog,
  hasInfiniteStars,
  type GiftKey,
} from "@/shared/lib/rewards/catalog"

type RewardsUser = {
  id: number
  email: string
  firstName: string
  lastName: string | null
  role: string
  starsBalance: number
}

export function RewardsHome({
  user,
}: {
  user: RewardsUser
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [giftKey, setGiftKey] = useState<GiftKey>(cryptoGiftCatalog[0]?.key ?? giftCatalog[0]?.key ?? "coffee")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [note, setNote] = useState("")
  const [starsBalance, setStarsBalance] = useState(user.starsBalance)
  const isInfinite = hasInfiniteStars(user.role)

  const selectedGift = cryptoGiftCatalog.find((item) => item.key === giftKey) ?? cryptoGiftCatalog[0] ?? null

  function sendCryptoGift() {
    if (!selectedGift) {
      return
    }

    if (!recipientEmail.trim()) {
      toast.error("Enter recipient email")
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/rewards/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail,
          giftKey: selectedGift.key,
          note,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Failed to send crypto gift")
        return
      }

      if (!data.sender?.infiniteStars && typeof data.sender?.starsBalance === "number") {
        setStarsBalance(data.sender.starsBalance)
      }

      setRecipientEmail("")
      setNote("")
      toast.success("Crypto gift sent")
    })
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.9))] px-4 py-5 pb-28 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_26%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.1),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))] sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <Card className="border-white/55 bg-card/84 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.5)] backdrop-blur-2xl dark:border-white/10">
          <CardHeader className="border-b border-border/55">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-2xl font-semibold">Crypto for Stars</CardTitle>
                <CardDescription>
                  Separate showcase page for crypto-themed gifts paid with stars.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => router.push("/")}>
                  Back to profile
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/rewards/sad")}>
                  <TrendingUpIcon className="size-4" />
                  Open SAD market
                </Button>
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                  <CoinsIcon className="mr-2 size-4" />
                  {isInfinite ? "Infinite stars" : `${starsBalance} stars`}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cryptoGiftCatalog.map((gift) => {
                  const active = gift.key === selectedGift?.key

                  return (
                    <button
                      key={gift.key}
                      type="button"
                      onClick={() => setGiftKey(gift.key)}
                      className={`overflow-hidden rounded-[1.6rem] border text-left transition ${
                        active
                          ? "border-primary bg-primary/5 shadow-[0_20px_50px_-28px_rgba(14,165,233,0.5)]"
                          : "border-border/70 bg-background/80 hover:border-primary/35 hover:bg-background"
                      }`}
                    >
                      <div className="relative h-44 w-full">
                        <Image src={gift.imageUrl} alt={gift.name} fill className="object-cover" />
                      </div>
                      <div className="space-y-2 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{gift.name}</p>
                          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                            {gift.cost} stars
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{gift.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Send Selected Crypto Gift</CardTitle>
                  <CardDescription>
                    Pick a recipient and send a crypto-themed reward through the existing stars flow.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedGift ? (
                    <div className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-background/80">
                      <div className="relative h-44 w-full">
                        <Image src={selectedGift.imageUrl} alt={selectedGift.name} fill className="object-cover" />
                      </div>
                      <div className="space-y-2 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-base font-semibold">{selectedGift.name}</p>
                          <div className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            <CoinsIcon className="mr-1 size-3.5" />
                            {selectedGift.cost}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{selectedGift.description}</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="cryptoRecipientEmail">Recipient email</Label>
                    <Input
                      id="cryptoRecipientEmail"
                      type="email"
                      value={recipientEmail}
                      onChange={(event) => setRecipientEmail(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cryptoGiftNote">Note</Label>
                    <Input
                      id="cryptoGiftNote"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-muted/35 p-4 text-sm">
                    <p className="font-medium">What this does</p>
                    <div className="mt-2 space-y-1 text-muted-foreground">
                      <p>Stars are charged only after successful gift creation.</p>
                      <p>The recipient sees the gift in profile gifts history.</p>
                      <p>This page uses the same secure rewards API as the profile page.</p>
                    </div>
                  </div>

                  <Button type="button" className="w-full" onClick={sendCryptoGift} disabled={isPending || !selectedGift}>
                    <SendIcon className="size-4" />
                    {isPending ? "Sending..." : "Send crypto gift"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-base">Why a separate page</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <ReasonCard
                  icon={<GemIcon className="size-5" />}
                  title="Focused showcase"
                  text="Crypto rewards no longer get lost inside the larger profile settings page."
                />
                <ReasonCard
                  icon={<CoinsIcon className="size-5" />}
                  title="Stars-first flow"
                  text="The page is dedicated to items that are explicitly purchased with stars."
                />
                <ReasonCard
                  icon={<GemIcon className="size-5" />}
                  title="Scalable"
                  text="It is easy to add more crypto-themed gifts or future exchange products here."
                />
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>

      <BottomNav active="settings" showServerTab={hasAdministrativeAccess(user.role)} />
    </main>
  )
}

function ReasonCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode
  title: string
  text: string
}) {
  return (
    <div className="rounded-[1.3rem] border border-border/70 bg-background/78 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <p className="font-semibold">{title}</p>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
