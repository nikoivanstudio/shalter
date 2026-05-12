"use client"

import { ActivityIcon, CpuIcon, HardDriveIcon, RefreshCcwIcon, TimerResetIcon } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"

type ServerMetrics = {
  snapshotAt: string
  host: string
  platform: string
  nodeVersion: string
  uptimeSeconds: number
  systemUptimeSeconds: number
  cpu: {
    cores: number
    model: string
    loadAverage: number[]
  }
  memory: {
    totalMb: number
    freeMb: number
    usedMb: number
    usedPercent: number
  }
  processMemory: {
    rssMb: number
    heapTotalMb: number
    heapUsedMb: number
    externalMb: number
  }
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}h ${minutes}m ${seconds}s`
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, value))
}

export function ServerHome({
  initialMetrics,
}: {
  initialMetrics: ServerMetrics
}) {
  const [metrics, setMetrics] = useState(initialMetrics)
  const [isRefreshing, startRefreshing] = useTransition()

  function refreshMetrics(showToast = false) {
    startRefreshing(async () => {
      const response = await fetch("/api/server/metrics", { cache: "no-store" })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        if (showToast) {
          toast.error(data?.message ?? "Failed to refresh server metrics")
        }
        return
      }

      setMetrics(data as ServerMetrics)
      if (showToast) {
        toast.success("Server metrics updated")
      }
    })
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshMetrics(false)
    }, 15000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const cpuLoadItems = [
    {
      label: "1m",
      value: clampPercent(((metrics.cpu.loadAverage[0] ?? 0) / Math.max(metrics.cpu.cores, 1)) * 100),
      tone: "sky" as const,
    },
    {
      label: "5m",
      value: clampPercent(((metrics.cpu.loadAverage[1] ?? 0) / Math.max(metrics.cpu.cores, 1)) * 100),
      tone: "emerald" as const,
    },
    {
      label: "15m",
      value: clampPercent(((metrics.cpu.loadAverage[2] ?? 0) / Math.max(metrics.cpu.cores, 1)) * 100),
      tone: "amber" as const,
    },
  ]

  const memoryItems = [
    {
      label: "System",
      value: clampPercent(metrics.memory.usedPercent),
      tone: "rose" as const,
    },
    {
      label: "Heap",
      value: clampPercent(
        metrics.processMemory.heapTotalMb > 0
          ? (metrics.processMemory.heapUsedMb / metrics.processMemory.heapTotalMb) * 100
          : 0
      ),
      tone: "sky" as const,
    },
    {
      label: "RSS",
      value: clampPercent(
        metrics.memory.totalMb > 0 ? (metrics.processMemory.rssMb / metrics.memory.totalMb) * 100 : 0
      ),
      tone: "emerald" as const,
    },
  ]

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.9))] px-4 py-5 pb-28 dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_26%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.1),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))] sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <Card className="border-white/55 bg-card/84 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.5)] backdrop-blur-2xl dark:border-white/10">
          <CardHeader className="border-b border-border/55">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-2xl font-semibold">Server</CardTitle>
                <CardDescription>
                  Separate metrics page with stable cards and fixed-height charts that do not jump during refresh.
                </CardDescription>
              </div>
              <Button type="button" onClick={() => refreshMetrics(true)} disabled={isRefreshing}>
                <RefreshCcwIcon className="size-4" />
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={<HardDriveIcon className="size-5" />}
                title="Host"
                value={metrics.host}
                hint={`${metrics.platform} · ${metrics.nodeVersion}`}
              />
              <MetricCard
                icon={<CpuIcon className="size-5" />}
                title="CPU"
                value={`${metrics.cpu.cores} cores`}
                hint={metrics.cpu.model}
              />
              <MetricCard
                icon={<ActivityIcon className="size-5" />}
                title="Memory"
                value={`${metrics.memory.usedPercent}%`}
                hint={`${metrics.memory.usedMb} / ${metrics.memory.totalMb} MB`}
              />
              <MetricCard
                icon={<TimerResetIcon className="size-5" />}
                title="Snapshot"
                value={new Date(metrics.snapshotAt).toLocaleTimeString("ru-RU")}
                hint={`App uptime: ${formatDuration(metrics.uptimeSeconds)}`}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">CPU Load</CardTitle>
                  <CardDescription>Fixed-height bars keep the chart from dropping while values update.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <MetricChart title="CPU load timeline" items={cpuLoadItems} />
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <p className="font-medium">Load average</p>
                    <p className="mt-1 text-muted-foreground">
                      1m: {metrics.cpu.loadAverage[0]?.toFixed(2) ?? "0.00"} · 5m:{" "}
                      {metrics.cpu.loadAverage[1]?.toFixed(2) ?? "0.00"} · 15m:{" "}
                      {metrics.cpu.loadAverage[2]?.toFixed(2) ?? "0.00"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <p className="font-medium">CPU model</p>
                    <p className="mt-1 text-muted-foreground">{metrics.cpu.model}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Memory</CardTitle>
                  <CardDescription>System memory and Node.js process memory in a more stable layout.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <MetricChart title="Memory usage" items={memoryItems} />
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <p className="font-medium">System</p>
                    <p className="mt-1 text-muted-foreground">
                      Used {metrics.memory.usedMb} MB of {metrics.memory.totalMb} MB
                    </p>
                    <p className="text-muted-foreground">Free {metrics.memory.freeMb} MB</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <p className="font-medium">Process</p>
                    <p className="mt-1 text-muted-foreground">RSS: {metrics.processMemory.rssMb} MB</p>
                    <p className="text-muted-foreground">
                      Heap: {metrics.processMemory.heapUsedMb} / {metrics.processMemory.heapTotalMb} MB
                    </p>
                    <p className="text-muted-foreground">
                      External: {metrics.processMemory.externalMb} MB
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-base">Uptime</CardTitle>
                <CardDescription>How long the app process and the system have been alive.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <p className="font-medium">Application process</p>
                  <p className="mt-1 text-muted-foreground">{formatDuration(metrics.uptimeSeconds)}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <p className="font-medium">Operating system</p>
                  <p className="mt-1 text-muted-foreground">{formatDuration(metrics.systemUptimeSeconds)}</p>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>

      <BottomNav active="server" showServerTab />
    </main>
  )
}

function MetricCard({
  icon,
  title,
  value,
  hint,
}: {
  icon: React.ReactNode
  title: string
  value: string
  hint: string
}) {
  return (
    <div className="min-h-36 rounded-[1.4rem] border border-border/70 bg-background/78 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
          <p className="truncate text-lg font-semibold">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}

function MetricChart({
  title,
  items,
}: {
  title: string
  items: Array<{
    label: string
    value: number
    tone: "sky" | "emerald" | "amber" | "rose"
  }>
}) {
  const toneClassByKey = {
    sky: "from-sky-400 to-sky-600",
    emerald: "from-emerald-400 to-emerald-600",
    amber: "from-amber-400 to-amber-600",
    rose: "from-rose-400 to-rose-600",
  } as const

  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <p className="font-medium">{title}</p>
      <div className="mt-4 grid min-h-40 grid-cols-3 items-end gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex min-h-40 flex-col items-center justify-end gap-2">
            <div className="flex h-28 w-full items-end rounded-[1.2rem] bg-muted/55 p-2">
              <div
                className={`w-full rounded-[0.9rem] bg-gradient-to-t ${toneClassByKey[item.tone]}`}
                style={{ height: `${Math.max(item.value, 8)}%` }}
              />
            </div>
            <p className="text-xs font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.value.toFixed(0)}%</p>
          </div>
        ))}
      </div>
    </div>
  )
}
