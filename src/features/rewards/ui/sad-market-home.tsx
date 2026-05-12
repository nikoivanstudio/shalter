"use client"

import { ArrowDownIcon, ArrowUpIcon, CoinsIcon, MinusIcon, SendIcon, TrendingUpIcon } from "lucide-react"
import Image from "next/image"
import { useMemo, useState, useTransition, type ReactNode } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { hasAdministrativeAccess } from "@/shared/lib/auth/roles"
import { getGiftByKey, hasInfiniteStars } from "@/shared/lib/rewards/catalog"

type RewardsUser = {
  id: number
  email: string
  firstName: string
  lastName: string | null
  role: string
  starsBalance: number
}

type TimeframeKey = "24H" | "7D" | "30D"

const SAD_GIFT_KEY = "sad-token"

const SAD_SERIES: Record<TimeframeKey, number[]> = {
  "24H": [0.84, 0.79, 0.81, 0.76, 0.73, 0.77, 0.82, 0.88, 0.9, 0.87, 0.91, 0.96],
  "7D": [0.62, 0.68, 0.59, 0.71, 0.82, 0.76, 0.96, 0.88, 1.02, 0.92, 1.07, 1.12],
  "30D": [0.28, 0.31, 0.37, 0.35, 0.48, 0.46, 0.63, 0.58, 0.79, 0.85, 1.01, 1.12],
}

const TIMEFRAME_LABELS: Record<TimeframeKey, string> = {
  "24H": "Intraday",
  "7D": "This week",
  "30D": "This month",
}

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`
}

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

function buildChartPoints(points: number[], width: number, height: number, padding: number) {
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  return points
    .map((point, index) => {
      const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2)
      const y = height - padding - ((point - min) / range) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(" ")
}

function TrendBadge({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">
        <ArrowUpIcon className="size-4" />
        {formatPercent(value)}
      </span>
    )
  }

  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/12 px-3 py-1 text-sm font-medium text-rose-700 dark:text-rose-300">
        <ArrowDownIcon className="size-4" />
        {formatPercent(value)}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
      <MinusIcon className="size-4" />
      Flat
    </span>
  )
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-[1.4rem] border border-border/70 bg-background/80 p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}

function InfoStrip({
  icon,
  title,
  text,
}: {
  icon: ReactNode
  title: string
  text: string
}) {
  return (
    <div className="rounded-[1.35rem] border border-border/70 bg-background/75 p-4">
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

export function SadMarketHome({
  user,
}: {
  user: RewardsUser
}) {
  const [timeframe, setTimeframe] = useState<TimeframeKey>("7D")
  const [note, setNote] = useState("")
  const [isPending, startTransition] = useTransition()
  const [starsBalance, setStarsBalance] = useState(user.starsBalance)
  const isInfinite = hasInfiniteStars(user.role)
  const sadGift = getGiftByKey(SAD_GIFT_KEY)

  const series = SAD_SERIES[timeframe]
  const currentPrice = series[series.length - 1]
  const openingPrice = series[0]
  const highestPrice = Math.max(...series)
  const lowestPrice = Math.min(...series)
  const changePercent = ((currentPrice - openingPrice) / openingPrice) * 100
  const reboundPercent = ((currentPrice - lowestPrice) / lowestPrice) * 100
  const drawdownPercent = ((currentPrice - highestPrice) / highestPrice) * 100
  const chartPoints = useMemo(() => buildChartPoints(series, 640, 260, 24), [series])

  function buySadToken() {
    if (!sadGift) {
      toast.error("SAD market is temporarily unavailable")
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/rewards/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: user.email,
          giftKey: sadGift.key,
          note: note.trim() || "Bought from SAD market",
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(data?.message ?? "Failed to buy SAD")
        return
      }

      if (!data.sender?.infiniteStars && typeof data.sender?.starsBalance === "number") {
        setStarsBalance(data.sender.starsBalance)
      }

      setNote("")
      toast.success("SAD was added to your profile gifts")
    })
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_24%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.12),transparent_26%),linear-gradient(180deg,rgba(255,252,248,0.98),rgba(248,250,252,0.94))] px-4 py-5 pb-28 dark:bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.22),transparent_24%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.12),transparent_26%),linear-gradient(180deg,rgba(5,10,18,0.98),rgba(15,23,42,0.94))] sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <Card className="overflow-hidden border-white/55 bg-card/86 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.5)] backdrop-blur-2xl dark:border-white/10">
          <CardContent className="p-0">
            <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-6 p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-foreground px-3 py-1 text-xs font-semibold uppercase tracking-[0.26em] text-background">
                    SAD market
                  </span>
                  <TrendBadge value={changePercent} />
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your own crypto for stars</h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                    SAD is a fictional house token for Shalter. It dips, rebounds, and comes with a clean
                    fixed-height chart so the page does not jump while you watch the market mood.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard
                    label="Current"
                    value={formatUsd(currentPrice)}
                    hint={`${TIMEFRAME_LABELS[timeframe]} closing price`}
                  />
                  <MetricCard
                    label="Rebound"
                    value={formatPercent(reboundPercent)}
                    hint={`From low ${formatUsd(lowestPrice)}`}
                  />
                  <MetricCard
                    label="Drawdown"
                    value={formatPercent(drawdownPercent)}
                    hint={`From high ${formatUsd(highestPrice)}`}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <InfoStrip
                    icon={<TrendingUpIcon className="size-5" />}
                    title="It rises and falls"
                    text="The series intentionally swings up and down instead of staying flat, so the token feels alive."
                  />
                  <InfoStrip
                    icon={<CoinsIcon className="size-5" />}
                    title={`${sadGift?.cost ?? 140} stars`}
                    text="Buying uses the same secure stars reward flow and lands in your own gifts history."
                  />
                  <InfoStrip
                    icon={<ArrowUpIcon className="size-5" />}
                    title="Stable layout"
                    text="The chart card has a locked height, so it does not drop down or push the rest of the page around."
                  />
                </div>
              </div>

              <div className="relative min-h-[320px] border-t border-border/60 bg-[linear-gradient(180deg,rgba(15,23,42,0.03),rgba(15,23,42,0.08))] p-5 lg:min-h-full lg:border-t-0 lg:border-l sm:p-6">
                <div className="absolute inset-x-6 top-6 h-24 rounded-full bg-amber-500/12 blur-3xl dark:bg-amber-500/16" />
                <div className="relative mx-auto flex max-w-[28rem] flex-col gap-4">
                  <div className="overflow-hidden rounded-[1.8rem] border border-white/15 bg-slate-950/90 shadow-[0_28px_70px_-40px_rgba(15,23,42,0.9)]">
                    <div className="relative h-72 w-full">
                      <Image src="/gifts/sad-token.svg" alt="SAD Token" fill className="object-cover" />
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-border/70 bg-background/88 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Wallet balance</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-2xl font-semibold">{isInfinite ? "Infinite stars" : `${starsBalance} stars`}</p>
                      <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        1 pack = {sadGift?.cost ?? 140}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/70">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">SAD Chart</CardTitle>
                  <CardDescription>
                    Fixed-size chart card with clear highs, lows, rebounds, and dips.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(["24H", "7D", "30D"] as const).map((item) => (
                    <Button
                      key={item}
                      type="button"
                      variant={timeframe === item ? "default" : "outline"}
                      className="min-w-16"
                      onClick={() => setTimeframe(item)}
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-[1.6rem] border border-border/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.08))] p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{TIMEFRAME_LABELS[timeframe]}</p>
                    <p className="mt-1 text-3xl font-semibold">{formatUsd(currentPrice)}</p>
                  </div>
                  <TrendBadge value={changePercent} />
                </div>

                <div className="h-[320px] rounded-[1.35rem] border border-white/50 bg-background/80 p-3 shadow-inner dark:border-white/8">
                  <svg viewBox="0 0 640 260" className="h-full w-full" preserveAspectRatio="none" aria-label="SAD market chart">
                    <defs>
                      <linearGradient id="sadArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={changePercent >= 0 ? "#22c55e" : "#f97316"} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={changePercent >= 0 ? "#22c55e" : "#f97316"} stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="sadLine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="50%" stopColor="#facc15" />
                        <stop offset="100%" stopColor="#22c55e" />
                      </linearGradient>
                    </defs>

                    {[0, 1, 2, 3].map((line) => (
                      <line
                        key={line}
                        x1="24"
                        x2="616"
                        y1={24 + line * 70}
                        y2={24 + line * 70}
                        stroke="currentColor"
                        strokeOpacity="0.08"
                      />
                    ))}

                    <polygon
                      points={`24,236 ${chartPoints} 616,236`}
                      fill="url(#sadArea)"
                    />
                    <polyline
                      points={chartPoints}
                      fill="none"
                      stroke="url(#sadLine)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <MetricCard label="Open" value={formatUsd(openingPrice)} hint="Start of selected range" />
                  <MetricCard label="Low" value={formatUsd(lowestPrice)} hint="Where the dip bottomed" />
                  <MetricCard label="High" value={formatUsd(highestPrice)} hint="Local top before pullback" />
                  <MetricCard label="Close" value={formatUsd(currentPrice)} hint="Latest SAD quote" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-xl">Buy SAD for stars</CardTitle>
              <CardDescription>
                Purchase one SAD reward pack for your own account through the existing gifts API.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-[1.4rem] border border-border/70 bg-background/85">
                <div className="relative h-48 w-full">
                  <Image src="/gifts/sad-token.svg" alt="SAD Token reward" fill className="object-cover" />
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold">SAD Token pack</p>
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {sadGift?.cost ?? 140} stars
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This writes the reward to your own profile history, so the coin feels like a collectible market buy.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sad-market-note">Purchase note</Label>
                <Input
                  id="sad-market-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Bought after the rebound"
                />
              </div>

              <div className="rounded-[1.3rem] border border-border/70 bg-muted/35 p-4 text-sm">
                <p className="font-medium">How it works</p>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  <p>Stars are charged only after the reward purchase succeeds.</p>
                  <p>The bought SAD pack is sent to your own account email: {user.email}</p>
                  <p>The chart is decorative market UI and stays visually stable on desktop and mobile.</p>
                </div>
              </div>

              <Button type="button" className="w-full" onClick={buySadToken} disabled={isPending}>
                <SendIcon className="size-4" />
                {isPending ? "Buying..." : "Buy SAD for stars"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <BottomNav active="settings" showServerTab={hasAdministrativeAccess(user.role)} />
    </main>
  )
}
