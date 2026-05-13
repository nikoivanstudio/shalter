"use client"

import { CrownIcon, Move3DIcon, RadioTowerIcon, ShieldIcon, SparklesIcon, SwordsIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"

type GameHomeProps = {
  playerId: string
  displayName: string
  phone: string
}

type FighterDefinition = {
  id: string
  name: string
  color: string
  accent: string
  speed: number
  maxHp: number
  damage: number
  projectileSpeed: number
  fireDelayMs: number
  superDurationMs: number
  description: string
}

type ActorState = {
  id: string
  name: string
  x: number
  y: number
  hp: number
  maxHp: number
  color: string
  angle: number
  fighterId: string
  isLocal?: boolean
}

type BotState = ActorState & {
  nextShotAt: number
  respawnAt: number
}

type ProjectileState = {
  id: string
  ownerId: string
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  color: string
}

type RemoteSnapshot = {
  playerId: string
  displayName: string
  fighterId: string
  color: string
  x: number
  y: number
  hp: number
  maxHp: number
  score: number
  superReady: boolean
}

type WorldView = {
  localPlayer: ActorState
  bots: BotState[]
  projectiles: ProjectileState[]
  remotePlayers: RemoteSnapshot[]
  score: number
  superCharge: number
  superActiveUntil: number
}

type ControlState = {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  fire: boolean
}

const ARENA_WIDTH = 880
const ARENA_HEIGHT = 540
const PLAYER_RADIUS = 22
const BOT_RADIUS = 20
const PROJECTILE_RADIUS = 7
const SPECIAL_PHONE = "79781827502"
const NETWORK_PUSH_MS = 180

const fighters: FighterDefinition[] = [
  {
    id: "vortex",
    name: "Вортекс",
    color: "#38bdf8",
    accent: "#0f172a",
    speed: 4.5,
    maxHp: 100,
    damage: 14,
    projectileSpeed: 10,
    fireDelayMs: 320,
    superDurationMs: 5000,
    description: "Универсальный штурмовик с быстрым темпом и контролем центра.",
  },
  {
    id: "ember",
    name: "Эмберлайн",
    color: "#fb7185",
    accent: "#7f1d1d",
    speed: 4.1,
    maxHp: 126,
    damage: 20,
    projectileSpeed: 8,
    fireDelayMs: 540,
    superDurationMs: 4600,
    description: "Тяжёлый дуэлянт, который переживает размены и больно наказывает.",
  },
  {
    id: "nova",
    name: "Нова",
    color: "#f59e0b",
    accent: "#78350f",
    speed: 5,
    maxHp: 88,
    damage: 12,
    projectileSpeed: 12,
    fireDelayMs: 220,
    superDurationMs: 4200,
    description: "Самый резкий боец в ростере с агрессивным супером на скорость.",
  },
  {
    id: "sage",
    name: "Сэйдж",
    color: "#4ade80",
    accent: "#14532d",
    speed: 4.2,
    maxHp: 108,
    damage: 16,
    projectileSpeed: 9,
    fireDelayMs: 360,
    superDurationMs: 5600,
    description: "Баланс урона и выживаемости для размеренного пуша по линии.",
  },
]

const arenaObstacles = [
  { id: "o1", x: 180, y: 120, width: 110, height: 56, height3d: 44 },
  { id: "o2", x: 520, y: 110, width: 140, height: 62, height3d: 56 },
  { id: "o3", x: 312, y: 280, width: 96, height: 86, height3d: 52 },
  { id: "o4", x: 660, y: 314, width: 132, height: 54, height3d: 46 },
]

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "")
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function distance(leftX: number, leftY: number, rightX: number, rightY: number) {
  return Math.hypot(leftX - rightX, leftY - rightY)
}

function collidesWithObstacle(x: number, y: number, radius: number) {
  return arenaObstacles.some((obstacle) => {
    const closestX = clamp(x, obstacle.x, obstacle.x + obstacle.width)
    const closestY = clamp(y, obstacle.y, obstacle.y + obstacle.height)
    return distance(x, y, closestX, closestY) < radius
  })
}

function randomSpawn(index = 0) {
  const positions = [
    { x: 100, y: 100 },
    { x: 760, y: 110 },
    { x: 150, y: 420 },
    { x: 748, y: 410 },
    { x: 445, y: 80 },
    { x: 448, y: 452 },
  ]

  return positions[index % positions.length]
}

function createBot(index: number): BotState {
  const definition = fighters[(index + 1) % fighters.length]
  const spawn = randomSpawn(index + 1)

  return {
    id: `bot-${index + 1}`,
    name: `${definition.name} ${index + 1}`,
    x: spawn.x,
    y: spawn.y,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    color: definition.color,
    angle: 0,
    fighterId: definition.id,
    nextShotAt: 0,
    respawnAt: 0,
  }
}

function createInitialWorld(fighter: FighterDefinition): WorldView {
  return {
    localPlayer: {
      id: "local",
      name: "Вы",
      x: 120,
      y: 270,
      hp: fighter.maxHp,
      maxHp: fighter.maxHp,
      color: fighter.color,
      angle: 0,
      fighterId: fighter.id,
      isLocal: true,
    },
    bots: Array.from({ length: 4 }, (_, index) => createBot(index)),
    projectiles: [],
    remotePlayers: [],
    score: 0,
    superCharge: 0,
    superActiveUntil: 0,
  }
}

function ControlButton({
  label,
  onPressChange,
  className,
}: {
  label: string
  onPressChange: (pressed: boolean) => void
  className?: string
}) {
  return (
    <button
      type="button"
      className={[
        "rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur active:scale-[0.98]",
        className,
      ].join(" ")}
      onPointerDown={() => onPressChange(true)}
      onPointerUp={() => onPressChange(false)}
      onPointerCancel={() => onPressChange(false)}
      onPointerLeave={() => onPressChange(false)}
    >
      {label}
    </button>
  )
}

export function GameHome({ playerId, displayName, phone }: GameHomeProps) {
  const isSpecialAccount = normalizePhone(phone) === SPECIAL_PHONE
  const availableFighters = isSpecialAccount ? fighters : fighters.slice(0, 1)
  const [selectedFighterId, setSelectedFighterId] = useState(availableFighters[0]?.id ?? fighters[0].id)
  const [roomId, setRoomId] = useState("arena")
  const [joinedRoomId, setJoinedRoomId] = useState("arena")
  const [remotePlayers, setRemotePlayers] = useState<RemoteSnapshot[]>([])
  const [view, setView] = useState<WorldView>(() => createInitialWorld(availableFighters[0] ?? fighters[0]))

  const viewRef = useRef(view)
  const controlsRef = useRef<ControlState>({ up: false, down: false, left: false, right: false, fire: false })
  const aimRef = useRef({ x: ARENA_WIDTH - 120, y: ARENA_HEIGHT / 2 })
  const dashReadyAtRef = useRef(0)
  const nextShotAtRef = useRef(0)
  const superReadyRef = useRef(false)
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fighter = useMemo(
    () => fighters.find((item) => item.id === selectedFighterId) ?? fighters[0],
    [selectedFighterId]
  )

  function applyFighterSelection(nextFighterId: string) {
    const nextFighter = fighters.find((item) => item.id === nextFighterId) ?? fighters[0]
    const nextWorld = createInitialWorld(nextFighter)
    nextWorld.remotePlayers = viewRef.current.remotePlayers

    setSelectedFighterId(nextFighterId)
    setView(nextWorld)
    viewRef.current = nextWorld
    nextShotAtRef.current = 0
    dashReadyAtRef.current = 0
    superReadyRef.current = false
  }

  useEffect(() => {
    function handleKeyChange(event: KeyboardEvent, pressed: boolean) {
      if (event.key === "w" || event.key === "ArrowUp") {
        controlsRef.current.up = pressed
      }
      if (event.key === "s" || event.key === "ArrowDown") {
        controlsRef.current.down = pressed
      }
      if (event.key === "a" || event.key === "ArrowLeft") {
        controlsRef.current.left = pressed
      }
      if (event.key === "d" || event.key === "ArrowRight") {
        controlsRef.current.right = pressed
      }
      if (event.key === " ") {
        controlsRef.current.fire = pressed
      }
      if (pressed && (event.key === "Shift" || event.key.toLowerCase() === "k")) {
        const current = viewRef.current
        const nextDashAt = Date.now()
        if (dashReadyAtRef.current <= nextDashAt) {
          const boost = fighter.speed * 16
          const dx = Math.cos(current.localPlayer.angle) * boost
          const dy = Math.sin(current.localPlayer.angle) * boost
          const nextX = clamp(current.localPlayer.x + dx, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS)
          const nextY = clamp(current.localPlayer.y + dy, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS)
          if (!collidesWithObstacle(nextX, nextY, PLAYER_RADIUS)) {
            current.localPlayer.x = nextX
            current.localPlayer.y = nextY
          }
          dashReadyAtRef.current = nextDashAt + 4200
        }
      }
      if (pressed && event.key.toLowerCase() === "q" && superReadyRef.current) {
        viewRef.current.superActiveUntil = Date.now() + fighter.superDurationMs
        viewRef.current.superCharge = 0
        superReadyRef.current = false
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => handleKeyChange(event, true)
    const handleKeyUp = (event: KeyboardEvent) => handleKeyChange(event, false)

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [fighter])

  useEffect(() => {
    let disposed = false
    const eventSource = new EventSource(`/api/game/room?room=${encodeURIComponent(joinedRoomId)}`)

    eventSource.addEventListener("snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        players: RemoteSnapshot[]
      }
      if (disposed) {
        return
      }

      const others = payload.players.filter((item) => item.playerId !== playerId)
      setRemotePlayers(others)
      setView((current) => {
        const next = { ...current, remotePlayers: others }
        viewRef.current = next
        return next
      })
    })

    eventSource.onerror = () => {
      toast.error("Онлайн-комната временно недоступна")
    }

    return () => {
      disposed = true
      eventSource.close()
      void fetch(`/api/game/room?room=${encodeURIComponent(joinedRoomId)}`, {
        method: "DELETE",
        keepalive: true,
      })
    }
  }, [joinedRoomId, playerId])

  useEffect(() => {
    syncTimerRef.current = setInterval(() => {
      const current = viewRef.current
      void fetch("/api/game/room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: joinedRoomId,
          displayName,
          fighterId: fighter.id,
          color: fighter.color,
          x: current.localPlayer.x,
          y: current.localPlayer.y,
          hp: current.localPlayer.hp,
          maxHp: current.localPlayer.maxHp,
          score: current.score,
          superReady: superReadyRef.current,
        }),
      })
    }, NETWORK_PUSH_MS)

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current)
        syncTimerRef.current = null
      }
    }
  }, [displayName, fighter.color, fighter.id, joinedRoomId])

  useEffect(() => {
    let frameId = 0
    let previousAt = performance.now()

    const tick = (now: number) => {
      const delta = Math.min(32, now - previousAt)
      previousAt = now

      const current = viewRef.current
      const moveSpeed =
        fighter.speed * (current.superActiveUntil > Date.now() ? 1.35 : 1) * (delta / 16.67) * 4.2
      let moveX = 0
      let moveY = 0

      if (controlsRef.current.up) {
        moveY -= 1
      }
      if (controlsRef.current.down) {
        moveY += 1
      }
      if (controlsRef.current.left) {
        moveX -= 1
      }
      if (controlsRef.current.right) {
        moveX += 1
      }

      if (moveX !== 0 || moveY !== 0) {
        const magnitude = Math.hypot(moveX, moveY)
        moveX /= magnitude
        moveY /= magnitude
        const nextX = clamp(current.localPlayer.x + moveX * moveSpeed, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS)
        const nextY = clamp(current.localPlayer.y + moveY * moveSpeed, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS)

        if (!collidesWithObstacle(nextX, nextY, PLAYER_RADIUS)) {
          current.localPlayer.x = nextX
          current.localPlayer.y = nextY
        }
      }

      current.localPlayer.angle = Math.atan2(
        aimRef.current.y - current.localPlayer.y,
        aimRef.current.x - current.localPlayer.x
      )

      if (controlsRef.current.fire && nextShotAtRef.current <= Date.now()) {
        const projectileSpeed =
          fighter.projectileSpeed * (current.superActiveUntil > Date.now() ? 1.18 : 1)
        current.projectiles.push({
          id: `${Date.now()}-${Math.random()}`,
          ownerId: current.localPlayer.id,
          x: current.localPlayer.x,
          y: current.localPlayer.y,
          vx: Math.cos(current.localPlayer.angle) * projectileSpeed,
          vy: Math.sin(current.localPlayer.angle) * projectileSpeed,
          damage: fighter.damage * (current.superActiveUntil > Date.now() ? 1.2 : 1),
          color: fighter.color,
        })
        nextShotAtRef.current = Date.now() + fighter.fireDelayMs
      }

      for (const bot of current.bots) {
        const botFighter = fighters.find((item) => item.id === bot.fighterId) ?? fighters[0]

        if (bot.hp <= 0) {
          if (bot.respawnAt > 0 && bot.respawnAt <= Date.now()) {
            const spawn = randomSpawn(Number(bot.id.replace("bot-", "")) + 2)
            bot.x = spawn.x
            bot.y = spawn.y
            bot.hp = bot.maxHp
            bot.respawnAt = 0
          }
          continue
        }

        const directionX = current.localPlayer.x - bot.x
        const directionY = current.localPlayer.y - bot.y
        const magnitude = Math.hypot(directionX, directionY) || 1
        const distanceToPlayer = magnitude

        bot.angle = Math.atan2(directionY, directionX)

        if (distanceToPlayer > 160) {
          const nextX = clamp(bot.x + (directionX / magnitude) * botFighter.speed * 2.6, BOT_RADIUS, ARENA_WIDTH - BOT_RADIUS)
          const nextY = clamp(bot.y + (directionY / magnitude) * botFighter.speed * 2.6, BOT_RADIUS, ARENA_HEIGHT - BOT_RADIUS)
          if (!collidesWithObstacle(nextX, nextY, BOT_RADIUS)) {
            bot.x = nextX
            bot.y = nextY
          }
        }

        if (distanceToPlayer < 310 && bot.nextShotAt <= Date.now()) {
          current.projectiles.push({
            id: `${bot.id}-${Date.now()}`,
            ownerId: bot.id,
            x: bot.x,
            y: bot.y,
            vx: Math.cos(bot.angle) * botFighter.projectileSpeed * 0.9,
            vy: Math.sin(bot.angle) * botFighter.projectileSpeed * 0.9,
            damage: botFighter.damage * 0.9,
            color: bot.color,
          })
          bot.nextShotAt = Date.now() + botFighter.fireDelayMs + 250
        }
      }

      current.projectiles = current.projectiles.filter((projectile) => {
        projectile.x += projectile.vx
        projectile.y += projectile.vy

        if (
          projectile.x < -20 ||
          projectile.x > ARENA_WIDTH + 20 ||
          projectile.y < -20 ||
          projectile.y > ARENA_HEIGHT + 20 ||
          collidesWithObstacle(projectile.x, projectile.y, PROJECTILE_RADIUS)
        ) {
          return false
        }

        if (projectile.ownerId !== current.localPlayer.id) {
          const hitLocal = distance(projectile.x, projectile.y, current.localPlayer.x, current.localPlayer.y) < PLAYER_RADIUS
          if (hitLocal) {
            current.localPlayer.hp = Math.max(0, current.localPlayer.hp - projectile.damage)
            if (current.localPlayer.hp === 0) {
              current.score = Math.max(0, current.score - 1)
              current.localPlayer.hp = current.localPlayer.maxHp
              current.localPlayer.x = 120
              current.localPlayer.y = 270
            }
            return false
          }
        }

        for (const bot of current.bots) {
          if (bot.hp <= 0 || projectile.ownerId === bot.id) {
            continue
          }

          if (distance(projectile.x, projectile.y, bot.x, bot.y) < BOT_RADIUS) {
            bot.hp = Math.max(0, bot.hp - projectile.damage)
            current.superCharge = clamp(current.superCharge + 16, 0, 100)
            if (bot.hp === 0) {
              bot.respawnAt = Date.now() + 2200
              current.score += 1
              current.superCharge = clamp(current.superCharge + 28, 0, 100)
            }
            return false
          }
        }

        return true
      })

      superReadyRef.current = current.superCharge >= 100

      const nextView = {
        ...current,
        localPlayer: { ...current.localPlayer },
        bots: current.bots.map((bot) => ({ ...bot })),
        projectiles: current.projectiles.map((projectile) => ({ ...projectile })),
        remotePlayers,
      }

      viewRef.current = nextView
      setView(nextView)
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [fighter, remotePlayers])

  const healthPercent = (view.localPlayer.hp / view.localPlayer.maxHp) * 100
  const superPercent = clamp(view.superCharge, 0, 100)

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.14),transparent_24%),linear-gradient(180deg,#07111f,#0f172a_45%,#111827)] pb-28 text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
        <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
          <Card className="overflow-hidden border-white/10 bg-white/5 p-0 backdrop-blur">
            <div className="border-b border-white/10 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/75">Shalter Arena</p>
                  <h1 className="mt-1 text-2xl font-black sm:text-3xl">Игра</h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-300">
                    Быстрая 3D-арена в духе hero shooter: движение, рывок, супер, охота на ботов и онлайн-комната для живых игроков.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-cyan-100">
                    Игрок: {displayName}
                  </span>
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-emerald-100">
                    Онлайн: {remotePlayers.length + 1}
                  </span>
                  {isSpecialAccount ? (
                    <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-amber-100">
                      Все бойцы открыты для {phone}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              <div
                className="relative mx-auto aspect-[16/10] w-full overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(14,165,233,0.16),rgba(15,23,42,0.96))] shadow-[0_32px_120px_-48px_rgba(34,211,238,0.45)]"
                onPointerMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  aimRef.current = {
                    x: ((event.clientX - rect.left) / rect.width) * ARENA_WIDTH,
                    y: ((event.clientY - rect.top) / rect.height) * ARENA_HEIGHT,
                  }
                }}
                onPointerDown={() => {
                  controlsRef.current.fire = true
                }}
                onPointerUp={() => {
                  controlsRef.current.fire = false
                }}
                onPointerLeave={() => {
                  controlsRef.current.fire = false
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.14),transparent_24%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.24),transparent_22%)]" />
                <div
                  className="absolute left-1/2 top-[52%] h-[84%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(17,94,89,0.7),rgba(22,78,99,0.95))] shadow-[inset_0_2px_0_rgba(255,255,255,0.08),0_32px_80px_-40px_rgba(0,0,0,0.9)]"
                  style={{
                    transform: "translate(-50%, -50%) perspective(1200px) rotateX(64deg)",
                    transformStyle: "preserve-3d",
                  }}
                >
                  {arenaObstacles.map((obstacle) => (
                    <div
                      key={obstacle.id}
                      className="absolute rounded-[1rem] border border-white/12 bg-[linear-gradient(180deg,rgba(248,250,252,0.22),rgba(15,23,42,0.75))] shadow-[0_12px_20px_rgba(2,6,23,0.45)]"
                      style={{
                        left: `${(obstacle.x / ARENA_WIDTH) * 100}%`,
                        top: `${(obstacle.y / ARENA_HEIGHT) * 100}%`,
                        width: `${(obstacle.width / ARENA_WIDTH) * 100}%`,
                        height: `${(obstacle.height / ARENA_HEIGHT) * 100}%`,
                        transform: `translateZ(${obstacle.height3d}px)`,
                      }}
                    />
                  ))}
                </div>

                {[view.localPlayer, ...view.bots, ...view.remotePlayers.map((player) => ({
                  id: player.playerId,
                  name: player.displayName,
                  x: player.x,
                  y: player.y,
                  hp: player.hp,
                  maxHp: player.maxHp,
                  color: player.color,
                  angle: 0,
                  fighterId: player.fighterId,
                }))].map((actor) => {
                  const hpPercent = (actor.hp / actor.maxHp) * 100
                  return (
                    <div
                      key={actor.id}
                      className="absolute"
                      style={{
                        left: `${(actor.x / ARENA_WIDTH) * 100}%`,
                        top: `${(actor.y / ARENA_HEIGHT) * 100}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <div
                        className="absolute left-1/2 top-[72%] h-4 w-10 -translate-x-1/2 rounded-full bg-black/30 blur-md"
                        style={{ transform: "translate(-50%, -50%) scale(1.1)" }}
                      />
                      <div
                        className="relative flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-white/20 text-[10px] font-black text-white shadow-[0_16px_40px_-20px_rgba(0,0,0,0.9)]"
                        style={{
                          background: `linear-gradient(180deg, ${actor.color}, rgba(15,23,42,0.92))`,
                          transform: `rotate(${(actor.angle * 180) / Math.PI}deg)`,
                        }}
                      >
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/35 px-2 py-1 text-[10px] font-semibold">
                          {actor.name}
                        </span>
                        <div className="h-3 w-3 rounded-full bg-white/90" />
                      </div>
                      <div className="mt-2 h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${hpPercent}%` }} />
                      </div>
                    </div>
                  )
                })}

                {view.projectiles.map((projectile) => (
                  <div
                    key={projectile.id}
                    className="absolute h-3.5 w-3.5 rounded-full border border-white/40 shadow-[0_0_18px_rgba(255,255,255,0.45)]"
                    style={{
                      left: `${(projectile.x / ARENA_WIDTH) * 100}%`,
                      top: `${(projectile.y / ARENA_HEIGHT) * 100}%`,
                      transform: "translate(-50%, -50%)",
                      background: projectile.color,
                    }}
                  />
                ))}

                <div className="absolute inset-x-4 top-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-52 rounded-2xl border border-white/10 bg-black/28 px-3 py-2 backdrop-blur">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>HP</span>
                      <span>
                        {Math.round(view.localPlayer.hp)}/{view.localPlayer.maxHp}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${healthPercent}%` }} />
                    </div>
                  </div>

                  <div className="min-w-52 rounded-2xl border border-white/10 bg-black/28 px-3 py-2 backdrop-blur">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Супер</span>
                      <span>{Math.round(superPercent)}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${superPercent}%` }} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/28 px-3 py-2 text-sm font-semibold backdrop-blur">
                    Счёт: {view.score}
                  </div>
                </div>

                <div className="absolute bottom-4 left-4 right-4 grid gap-3 md:hidden">
                  <div className="grid grid-cols-3 gap-2">
                    <ControlButton label="↖" onPressChange={(pressed) => {
                      controlsRef.current.up = pressed
                      controlsRef.current.left = pressed
                    }} />
                    <ControlButton label="↑" onPressChange={(pressed) => {
                      controlsRef.current.up = pressed
                    }} />
                    <ControlButton label="↗" onPressChange={(pressed) => {
                      controlsRef.current.up = pressed
                      controlsRef.current.right = pressed
                    }} />
                    <ControlButton label="←" onPressChange={(pressed) => {
                      controlsRef.current.left = pressed
                    }} />
                    <ControlButton label="↓" onPressChange={(pressed) => {
                      controlsRef.current.down = pressed
                    }} />
                    <ControlButton label="→" onPressChange={(pressed) => {
                      controlsRef.current.right = pressed
                    }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <ControlButton label="Огонь" onPressChange={(pressed) => {
                      controlsRef.current.fire = pressed
                    }} className="bg-rose-400/25" />
                    <ControlButton label="Рывок" onPressChange={(pressed) => {
                      if (pressed && dashReadyAtRef.current <= Date.now()) {
                        const current = viewRef.current
                        const nextX = clamp(current.localPlayer.x + Math.cos(current.localPlayer.angle) * fighter.speed * 16, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS)
                        const nextY = clamp(current.localPlayer.y + Math.sin(current.localPlayer.angle) * fighter.speed * 16, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS)
                        if (!collidesWithObstacle(nextX, nextY, PLAYER_RADIUS)) {
                          current.localPlayer.x = nextX
                          current.localPlayer.y = nextY
                        }
                        dashReadyAtRef.current = Date.now() + 4200
                      }
                    }} className="bg-cyan-400/25" />
                    <ControlButton label="Супер" onPressChange={(pressed) => {
                      if (pressed && superReadyRef.current) {
                        viewRef.current.superActiveUntil = Date.now() + fighter.superDurationMs
                        viewRef.current.superCharge = 0
                        superReadyRef.current = false
                      }
                    }} className="bg-amber-400/25" />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4">
            <Card className="border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-lg font-bold">
                <Move3DIcon className="size-5 text-cyan-300" />
                Управление
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <p>`WASD` или стрелки для движения.</p>
                <p>`Space` или тап по арене для стрельбы.</p>
                <p>`Shift`/`K` для рывка, `Q` для супера.</p>
              </div>
            </Card>

            <Card className="border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-lg font-bold">
                <SwordsIcon className="size-5 text-rose-300" />
                Бойцы
              </div>
              <div className="mt-3 grid gap-3">
                {fighters.map((item) => {
                  const unlocked = availableFighters.some((fighterItem) => fighterItem.id === item.id)
                  const active = selectedFighterId === item.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => {
                        if (unlocked) {
                          applyFighterSelection(item.id)
                        }
                      }}
                      className={[
                        "rounded-[1.4rem] border px-4 py-3 text-left transition",
                        active ? "border-white/40 bg-white/14" : "border-white/10 bg-white/6",
                        unlocked ? "hover:bg-white/10" : "cursor-not-allowed opacity-45",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="h-4 w-4 rounded-full" style={{ background: item.color }} />
                          <span className="font-semibold">{item.name}</span>
                        </div>
                        {unlocked ? (
                          active ? <CrownIcon className="size-4 text-amber-300" /> : <ShieldIcon className="size-4 text-slate-300" />
                        ) : (
                          <span className="text-xs text-slate-400">Закрыт</span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                    </button>
                  )
                })}
              </div>
            </Card>

            <Card className="border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-lg font-bold">
                <RadioTowerIcon className="size-5 text-emerald-300" />
                Онлайн-комната
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)}
                  className="border-white/10 bg-black/20 text-white"
                  placeholder="arena"
                />
                <Button
                  onClick={() => {
                    const nextRoomId = roomId.trim() || "arena"
                    setRoomId(nextRoomId)
                    setJoinedRoomId(nextRoomId)
                    toast.success(`Подключено к комнате ${nextRoomId}`)
                  }}
                >
                  Войти
                </Button>
              </div>
              <p className="mt-3 text-sm text-slate-300">
                Сейчас вы в комнате <span className="font-semibold text-white">{joinedRoomId}</span>.
              </p>
              <div className="mt-4 space-y-2">
                {remotePlayers.length === 0 ? (
                  <p className="text-sm text-slate-400">Пока вы один в комнате. Откройте игру на другом аккаунте и войдите в ту же комнату.</p>
                ) : (
                  remotePlayers.map((player) => (
                    <div key={player.playerId} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div>
                        <p className="font-semibold">{player.displayName}</p>
                        <p className="text-xs text-slate-400">
                          {fighters.find((item) => item.id === player.fighterId)?.name ?? "Боец"}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-300">
                        <p>HP {Math.round(player.hp)}</p>
                        <p>Счёт {player.score}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-lg font-bold">
                <SparklesIcon className="size-5 text-amber-300" />
                Что уже работает
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <p>3D-арена с перспективой, препятствиями, стрельбой и ИИ-противниками.</p>
                <p>Онлайн-присутствие игроков в одной комнате через realtime SSE.</p>
                <p>Моментальная разблокировка всех бойцов для номера +7 9781827502.</p>
              </div>
            </Card>
          </div>
        </section>
      </div>

      <BottomNav active="game" />
    </main>
  )
}
