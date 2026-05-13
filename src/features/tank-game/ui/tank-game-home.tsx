"use client"

import {
  ChevronLeftIcon,
  CrosshairIcon,
  GaugeIcon,
  MapIcon,
  RadioTowerIcon,
  ShieldIcon,
  SparklesIcon,
  TargetIcon,
  TimerIcon,
  TrophyIcon,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { cn } from "@/lib/utils"

type TankGameHomeProps = {
  playerId: string
  displayName: string
}

type TankClass = {
  id: string
  name: string
  color: string
  speed: number
  turnRate: number
  turretTurnRate: number
  maxHp: number
  damage: number
  reloadMs: number
  shellSpeed: number
  description: string
}

type TankMap = {
  id: string
  name: string
  description: string
  tint: string
  obstacles: Array<{ id: string; x: number; y: number; width: number; height: number }>
  spawns: Array<{ x: number; y: number }>
}

type TankMode = {
  id: string
  name: string
  description: string
  botCount: number
  scoreToWin: number
}

type TankState = {
  id: string
  name: string
  x: number
  y: number
  hullAngle: number
  turretAngle: number
  hp: number
  maxHp: number
  color: string
  classId: string
  score: number
}

type BotTankState = TankState & {
  reloadReadyAt: number
  respawnAt: number
}

type ShellState = {
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

type WorldState = {
  localTank: TankState
  bots: BotTankState[]
  shells: ShellState[]
  remotePlayers: RemoteSnapshot[]
}

type Controls = {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  fire: boolean
}

const WORLD_WIDTH = 1080
const WORLD_HEIGHT = 660
const TANK_RADIUS = 26
const SHELL_RADIUS = 6
const NETWORK_PUSH_MS = 180

const tankClasses: TankClass[] = [
  {
    id: "scout",
    name: "Скаут",
    color: "#22c55e",
    speed: 4.9,
    turnRate: 0.055,
    turretTurnRate: 0.11,
    maxHp: 90,
    damage: 17,
    reloadMs: 680,
    shellSpeed: 11,
    description: "Лёгкий танк для быстрых обходов и активной разведки.",
  },
  {
    id: "medium",
    name: "Страйкер",
    color: "#38bdf8",
    speed: 4.1,
    turnRate: 0.045,
    turretTurnRate: 0.095,
    maxHp: 118,
    damage: 22,
    reloadMs: 900,
    shellSpeed: 10,
    description: "Средний танк с хорошим балансом урона и подвижности.",
  },
  {
    id: "heavy",
    name: "Бастион",
    color: "#f97316",
    speed: 3.1,
    turnRate: 0.03,
    turretTurnRate: 0.075,
    maxHp: 168,
    damage: 32,
    reloadMs: 1350,
    shellSpeed: 8.8,
    description: "Тяжёлый танк для продавливания линии и размена корпусом.",
  },
  {
    id: "sniper",
    name: "Сентинел",
    color: "#a78bfa",
    speed: 3.6,
    turnRate: 0.034,
    turretTurnRate: 0.07,
    maxHp: 104,
    damage: 41,
    reloadMs: 1650,
    shellSpeed: 12.8,
    description: "Дальнобойная ПТ-машина с высоким разовым уроном.",
  },
]

const tankModes: TankMode[] = [
  {
    id: "skirmish",
    name: "Схватка",
    description: "Быстрые городские стычки с упором на точность и темп.",
    botCount: 5,
    scoreToWin: 8,
  },
  {
    id: "breakthrough",
    name: "Прорыв",
    description: "Больше машин на карте и более длинный матч на продавливание.",
    botCount: 7,
    scoreToWin: 12,
  },
]

const tankMaps: TankMap[] = [
  {
    id: "iron-crossing",
    name: "Железный узел",
    description: "Полуоткрытая карта с развилками, контейнерами и прострелами по центру.",
    tint: "linear-gradient(180deg,rgba(59,130,246,0.14),rgba(17,24,39,0.96))",
    spawns: [
      { x: 120, y: 110 },
      { x: 940, y: 120 },
      { x: 130, y: 550 },
      { x: 940, y: 540 },
      { x: 540, y: 110 },
      { x: 540, y: 540 },
      { x: 250, y: 330 },
      { x: 830, y: 330 },
    ],
    obstacles: [
      { id: "ic1", x: 220, y: 150, width: 180, height: 70 },
      { id: "ic2", x: 680, y: 150, width: 180, height: 70 },
      { id: "ic3", x: 460, y: 140, width: 160, height: 60 },
      { id: "ic4", x: 280, y: 420, width: 160, height: 80 },
      { id: "ic5", x: 640, y: 420, width: 160, height: 80 },
      { id: "ic6", x: 492, y: 300, width: 96, height: 90 },
    ],
  },
  {
    id: "red-quarry",
    name: "Красный карьер",
    description: "Карта с массивными камнями, короткими линиями и опасными флангами.",
    tint: "linear-gradient(180deg,rgba(239,68,68,0.14),rgba(17,24,39,0.96))",
    spawns: [
      { x: 140, y: 120 },
      { x: 930, y: 120 },
      { x: 160, y: 550 },
      { x: 920, y: 540 },
      { x: 540, y: 90 },
      { x: 540, y: 570 },
      { x: 270, y: 330 },
      { x: 820, y: 330 },
    ],
    obstacles: [
      { id: "rq1", x: 190, y: 210, width: 150, height: 90 },
      { id: "rq2", x: 740, y: 210, width: 150, height: 90 },
      { id: "rq3", x: 440, y: 180, width: 200, height: 80 },
      { id: "rq4", x: 380, y: 380, width: 130, height: 90 },
      { id: "rq5", x: 560, y: 380, width: 130, height: 90 },
    ],
  },
]

function randomFraction() {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return bytes[0] / 4294967295
}

function randomInt(maxExclusive: number) {
  return Math.floor(randomFraction() * maxExclusive)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by)
}

function normalizeAngle(angle: number) {
  let current = angle
  while (current > Math.PI) {
    current -= Math.PI * 2
  }
  while (current < -Math.PI) {
    current += Math.PI * 2
  }
  return current
}

function pickSpawn(currentMap: TankMap, index: number) {
  return currentMap.spawns[index % currentMap.spawns.length]
}

function collidesWithObstacle(x: number, y: number, radius: number, currentMap: TankMap) {
  return currentMap.obstacles.some((obstacle) => {
    const closestX = clamp(x, obstacle.x, obstacle.x + obstacle.width)
    const closestY = clamp(y, obstacle.y, obstacle.y + obstacle.height)
    return distance(x, y, closestX, closestY) < radius
  })
}

function createBot(index: number, currentMap: TankMap): BotTankState {
  const tankClass = tankClasses[index % tankClasses.length]
  const spawn = pickSpawn(currentMap, index + 1)

  return {
    id: `tank-bot-${index + 1}`,
    name: `${tankClass.name} ${index + 1}`,
    x: spawn.x,
    y: spawn.y,
    hullAngle: 0,
    turretAngle: 0,
    hp: tankClass.maxHp,
    maxHp: tankClass.maxHp,
    color: tankClass.color,
    classId: tankClass.id,
    score: 0,
    reloadReadyAt: 0,
    respawnAt: 0,
  }
}

function createWorldState(tankClass: TankClass, currentMap: TankMap, mode: TankMode): WorldState {
  const spawn = pickSpawn(currentMap, 0)

  return {
    localTank: {
      id: "local-tank",
      name: "Вы",
      x: spawn.x,
      y: spawn.y,
      hullAngle: 0,
      turretAngle: 0,
      hp: tankClass.maxHp,
      maxHp: tankClass.maxHp,
      color: tankClass.color,
      classId: tankClass.id,
      score: 0,
    },
    bots: Array.from({ length: mode.botCount }, (_, index) => createBot(index, currentMap)),
    shells: [],
    remotePlayers: [],
  }
}

export function TankGameHome({ playerId, displayName }: TankGameHomeProps) {
  const [modeId, setModeId] = useState(tankModes[0].id)
  const [mapId, setMapId] = useState(tankMaps[0].id)
  const [tankClassId, setTankClassId] = useState(tankClasses[1].id)
  const [roomId, setRoomId] = useState("convoy")
  const [joinedRoomId, setJoinedRoomId] = useState("convoy")
  const [remotePlayers, setRemotePlayers] = useState<RemoteSnapshot[]>([])
  const [reloadPercent, setReloadPercent] = useState(100)

  const currentMode = useMemo(
    () => tankModes.find((item) => item.id === modeId) ?? tankModes[0],
    [modeId]
  )
  const currentMap = useMemo(
    () => tankMaps.find((item) => item.id === mapId) ?? tankMaps[0],
    [mapId]
  )
  const currentClass = useMemo(
    () => tankClasses.find((item) => item.id === tankClassId) ?? tankClasses[0],
    [tankClassId]
  )
  const [world, setWorld] = useState<WorldState>(() => createWorldState(currentClass, currentMap, currentMode))

  const worldRef = useRef(world)
  const controlsRef = useRef<Controls>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    fire: false,
  })
  const aimRef = useRef({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 })
  const reloadReadyAtRef = useRef(0)
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const resetBattle = useCallback(
    (nextClassId = tankClassId, nextModeId = modeId, nextMapId = mapId) => {
      const nextClass = tankClasses.find((item) => item.id === nextClassId) ?? tankClasses[0]
      const nextMode = tankModes.find((item) => item.id === nextModeId) ?? tankModes[0]
      const nextMap = tankMaps.find((item) => item.id === nextMapId) ?? tankMaps[0]
      const nextWorld = createWorldState(nextClass, nextMap, nextMode)
      nextWorld.remotePlayers = worldRef.current.remotePlayers
      setWorld(nextWorld)
      setReloadPercent(100)
      worldRef.current = nextWorld
      reloadReadyAtRef.current = 0
    },
    [mapId, modeId, tankClassId]
  )

  useEffect(() => {
    function onKeyChange(event: KeyboardEvent, pressed: boolean) {
      if (event.key === "w" || event.key === "ArrowUp") {
        controlsRef.current.forward = pressed
      }
      if (event.key === "s" || event.key === "ArrowDown") {
        controlsRef.current.backward = pressed
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
    }

    const handleKeyDown = (event: KeyboardEvent) => onKeyChange(event, true)
    const handleKeyUp = (event: KeyboardEvent) => onKeyChange(event, false)

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

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
      setWorld((current) => {
        const next = { ...current, remotePlayers: others }
        worldRef.current = next
        return next
      })
    })

    eventSource.onerror = () => {
      toast.error("Танковая онлайн-комната временно недоступна")
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
      const current = worldRef.current
      void fetch("/api/game/room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: joinedRoomId,
          displayName,
          fighterId: currentClass.id,
          color: currentClass.color,
          x: current.localTank.x,
          y: current.localTank.y,
          hp: current.localTank.hp,
          maxHp: current.localTank.maxHp,
          score: current.localTank.score,
          superReady: false,
        }),
      })
    }, NETWORK_PUSH_MS)

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current)
        syncTimerRef.current = null
      }
    }
  }, [currentClass.color, currentClass.id, displayName, joinedRoomId])

  useEffect(() => {
    let frameId = 0
    let previousAt = 0

    const tick = (now: number) => {
      if (previousAt === 0) {
        previousAt = now
      }

      const delta = Math.min(32, now - previousAt)
      previousAt = now

      const current = worldRef.current

      if (controlsRef.current.left) {
        current.localTank.hullAngle -= currentClass.turnRate * (delta / 16.67)
      }
      if (controlsRef.current.right) {
        current.localTank.hullAngle += currentClass.turnRate * (delta / 16.67)
      }

      let movement = 0
      if (controlsRef.current.forward) {
        movement = currentClass.speed
      } else if (controlsRef.current.backward) {
        movement = -currentClass.speed * 0.72
      }

      if (movement !== 0) {
        const nextX = clamp(
          current.localTank.x + Math.cos(current.localTank.hullAngle) * movement * (delta / 16.67) * 3.8,
          TANK_RADIUS,
          WORLD_WIDTH - TANK_RADIUS
        )
        const nextY = clamp(
          current.localTank.y + Math.sin(current.localTank.hullAngle) * movement * (delta / 16.67) * 3.8,
          TANK_RADIUS,
          WORLD_HEIGHT - TANK_RADIUS
        )

        if (!collidesWithObstacle(nextX, nextY, TANK_RADIUS, currentMap)) {
          current.localTank.x = nextX
          current.localTank.y = nextY
        }
      }

      const targetAngle = Math.atan2(
        aimRef.current.y - current.localTank.y,
        aimRef.current.x - current.localTank.x
      )
      const turretDiff = normalizeAngle(targetAngle - current.localTank.turretAngle)
      const turretStep = clamp(
        turretDiff,
        -currentClass.turretTurnRate * (delta / 16.67) * 1.8,
        currentClass.turretTurnRate * (delta / 16.67) * 1.8
      )
      current.localTank.turretAngle += turretStep

      if (controlsRef.current.fire && reloadReadyAtRef.current <= Date.now()) {
        current.shells.push({
          id: `shell-${Date.now()}-${randomInt(99999)}`,
          ownerId: current.localTank.id,
          x: current.localTank.x + Math.cos(current.localTank.turretAngle) * 28,
          y: current.localTank.y + Math.sin(current.localTank.turretAngle) * 28,
          vx: Math.cos(current.localTank.turretAngle) * currentClass.shellSpeed,
          vy: Math.sin(current.localTank.turretAngle) * currentClass.shellSpeed,
          damage: currentClass.damage,
          color: currentClass.color,
        })
        reloadReadyAtRef.current = Date.now() + currentClass.reloadMs
      }

      for (const bot of current.bots) {
        const botClass = tankClasses.find((item) => item.id === bot.classId) ?? tankClasses[0]

        if (bot.hp <= 0) {
          if (bot.respawnAt > 0 && bot.respawnAt <= Date.now()) {
            const spawn = pickSpawn(currentMap, Number(bot.id.replace("tank-bot-", "")))
            bot.x = spawn.x
            bot.y = spawn.y
            bot.hp = bot.maxHp
            bot.respawnAt = 0
          }
          continue
        }

        const dx = current.localTank.x - bot.x
        const dy = current.localTank.y - bot.y
        const range = Math.hypot(dx, dy) || 1
        const hullTarget = Math.atan2(dy, dx)
        const hullDiff = normalizeAngle(hullTarget - bot.hullAngle)
        bot.hullAngle += clamp(hullDiff, -botClass.turnRate, botClass.turnRate)
        bot.turretAngle = hullTarget

        if (range > 220) {
          const nextX = clamp(bot.x + Math.cos(bot.hullAngle) * botClass.speed * 2.8, TANK_RADIUS, WORLD_WIDTH - TANK_RADIUS)
          const nextY = clamp(bot.y + Math.sin(bot.hullAngle) * botClass.speed * 2.8, TANK_RADIUS, WORLD_HEIGHT - TANK_RADIUS)
          if (!collidesWithObstacle(nextX, nextY, TANK_RADIUS, currentMap)) {
            bot.x = nextX
            bot.y = nextY
          }
        }

        if (range < 420 && bot.reloadReadyAt <= Date.now()) {
          current.shells.push({
            id: `bot-shell-${bot.id}-${Date.now()}`,
            ownerId: bot.id,
            x: bot.x + Math.cos(bot.turretAngle) * 28,
            y: bot.y + Math.sin(bot.turretAngle) * 28,
            vx: Math.cos(bot.turretAngle) * botClass.shellSpeed * 0.95,
            vy: Math.sin(bot.turretAngle) * botClass.shellSpeed * 0.95,
            damage: botClass.damage,
            color: bot.color,
          })
          bot.reloadReadyAt = Date.now() + botClass.reloadMs + 240
        }
      }

      current.shells = current.shells.filter((shell) => {
        shell.x += shell.vx
        shell.y += shell.vy

        if (
          shell.x < -20 ||
          shell.x > WORLD_WIDTH + 20 ||
          shell.y < -20 ||
          shell.y > WORLD_HEIGHT + 20 ||
          collidesWithObstacle(shell.x, shell.y, SHELL_RADIUS, currentMap)
        ) {
          return false
        }

        if (shell.ownerId !== current.localTank.id) {
          const hitLocal = distance(shell.x, shell.y, current.localTank.x, current.localTank.y) < TANK_RADIUS
          if (hitLocal) {
            current.localTank.hp = Math.max(0, current.localTank.hp - shell.damage)
            if (current.localTank.hp === 0) {
              current.localTank.score = Math.max(0, current.localTank.score - 1)
              const spawn = pickSpawn(currentMap, 0)
              current.localTank.x = spawn.x
              current.localTank.y = spawn.y
              current.localTank.hp = current.localTank.maxHp
            }
            return false
          }
        }

        for (const bot of current.bots) {
          if (bot.hp <= 0 || shell.ownerId === bot.id) {
            continue
          }

          if (distance(shell.x, shell.y, bot.x, bot.y) < TANK_RADIUS) {
            bot.hp = Math.max(0, bot.hp - shell.damage)
            if (bot.hp === 0) {
              bot.respawnAt = Date.now() + 2600
              current.localTank.score += 1
            }
            return false
          }
        }

        return true
      })

      if (current.localTank.score >= currentMode.scoreToWin) {
        toast.success(`Победа в режиме «${currentMode.name}»`)
        resetBattle(tankClassId, modeId, mapId)
        frameId = window.requestAnimationFrame(tick)
        return
      }

      const nextWorld = {
        ...current,
        localTank: { ...current.localTank },
        bots: current.bots.map((bot) => ({ ...bot })),
        shells: current.shells.map((shell) => ({ ...shell })),
        remotePlayers,
      }

      setReloadPercent(
        clamp(100 - ((reloadReadyAtRef.current - now) / currentClass.reloadMs) * 100, 0, 100)
      )
      worldRef.current = nextWorld
      setWorld(nextWorld)
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [currentClass, currentMap, currentMode, mapId, modeId, remotePlayers, resetBattle, tankClassId])

  const hpPercent = (world.localTank.hp / world.localTank.maxHp) * 100

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.18),transparent_24%),linear-gradient(180deg,#090f1a,#111827_46%,#161b22)] pb-28 text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
        <section className="grid gap-4 xl:grid-cols-[1.42fr_0.58fr]">
          <Card className="overflow-hidden border-white/10 bg-white/5 p-0 backdrop-blur">
            <div className="border-b border-white/10 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/75">Steel Convoy Online</p>
                  <h1 className="mt-1 text-2xl font-black sm:text-3xl">Танковый бой</h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-300">
                    Это оригинальная онлайн-танковая игра в духе больших аркадных танковых сражений: классы машин, укрытия, пробросы по линии и комнаты для нескольких игроков.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/game"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "inline-flex border-white/15 bg-white/5 text-white"
                    )}
                  >
                    <ChevronLeftIcon className="size-4" />
                    К арене героев
                  </Link>
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
                    Онлайн: {remotePlayers.length + 1}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              <div
                className="relative mx-auto aspect-[16/10] w-full overflow-hidden rounded-[2rem] border border-white/12 shadow-[0_32px_120px_-48px_rgba(34,211,238,0.45)]"
                style={{ background: currentMap.tint }}
                onPointerMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  aimRef.current = {
                    x: ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH,
                    y: ((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT,
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
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.12),transparent_26%),radial-gradient(circle_at_85%_0%,rgba(34,211,238,0.14),transparent_24%)]" />
                <div className="absolute inset-4 rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(71,85,105,0.22),rgba(15,23,42,0.45))]" />

                {currentMap.obstacles.map((obstacle) => (
                  <div
                    key={obstacle.id}
                    className="absolute rounded-[1.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(148,163,184,0.18),rgba(31,41,55,0.82))] shadow-[0_16px_36px_-18px_rgba(0,0,0,0.7)]"
                    style={{
                      left: `${(obstacle.x / WORLD_WIDTH) * 100}%`,
                      top: `${(obstacle.y / WORLD_HEIGHT) * 100}%`,
                      width: `${(obstacle.width / WORLD_WIDTH) * 100}%`,
                      height: `${(obstacle.height / WORLD_HEIGHT) * 100}%`,
                    }}
                  />
                ))}

                {[
                  world.localTank,
                  ...world.bots,
                  ...world.remotePlayers.map((player) => ({
                    id: player.playerId,
                    name: player.displayName,
                    x: player.x,
                    y: player.y,
                    hullAngle: 0,
                    turretAngle: 0,
                    hp: player.hp,
                    maxHp: player.maxHp,
                    color: player.color,
                    classId: player.fighterId,
                    score: player.score,
                  })),
                ].map((tank) => {
                  const health = (tank.hp / tank.maxHp) * 100
                  return (
                    <div
                      key={tank.id}
                      className="absolute"
                      style={{
                        left: `${(tank.x / WORLD_WIDTH) * 100}%`,
                        top: `${(tank.y / WORLD_HEIGHT) * 100}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <div className="absolute left-1/2 top-[76%] h-4 w-12 -translate-x-1/2 rounded-full bg-black/35 blur-md" />
                      <div
                        className="relative h-11 w-14 rounded-[0.95rem] border border-white/20 shadow-[0_20px_40px_-22px_rgba(0,0,0,0.95)]"
                        style={{
                          background: `linear-gradient(180deg, ${tank.color}, rgba(17,24,39,0.95))`,
                          transform: `rotate(${(tank.hullAngle * 180) / Math.PI}deg)`,
                        }}
                      >
                        <div className="absolute inset-[14%] rounded-[0.75rem] border border-white/12 bg-black/18" />
                        <div
                          className="absolute left-1/2 top-1/2 h-4 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-slate-900/70"
                          style={{
                            transform: `translate(-50%, -50%) rotate(${(tank.turretAngle * 180) / Math.PI}deg)`,
                            transformOrigin: "center center",
                          }}
                        >
                          <div className="absolute left-1/2 top-1/2 h-1.5 w-10 -translate-y-1/2 rounded-full bg-slate-100/90" />
                        </div>
                      </div>
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/35 px-2 py-1 text-[10px] font-semibold">
                        {tank.name}
                      </span>
                      <div className="mt-2 h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${health}%` }} />
                      </div>
                    </div>
                  )
                })}

                {world.shells.map((shell) => (
                  <div
                    key={shell.id}
                    className="absolute h-3 w-3 rounded-full border border-white/35 shadow-[0_0_18px_rgba(255,255,255,0.42)]"
                    style={{
                      left: `${(shell.x / WORLD_WIDTH) * 100}%`,
                      top: `${(shell.y / WORLD_HEIGHT) * 100}%`,
                      transform: "translate(-50%, -50%)",
                      background: shell.color,
                    }}
                  />
                ))}

                <div className="absolute inset-x-4 top-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-52 rounded-2xl border border-white/10 bg-black/28 px-3 py-2 backdrop-blur">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>HP</span>
                      <span>
                        {Math.round(world.localTank.hp)}/{world.localTank.maxHp}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${hpPercent}%` }} />
                    </div>
                  </div>

                  <div className="min-w-52 rounded-2xl border border-white/10 bg-black/28 px-3 py-2 backdrop-blur">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Перезарядка</span>
                      <span>{Math.round(reloadPercent)}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${reloadPercent}%` }} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/28 px-3 py-2 text-sm font-semibold backdrop-blur">
                    Счёт: {world.localTank.score}/{currentMode.scoreToWin}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4">
            <Card className="border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-lg font-bold">
                <TrophyIcon className="size-5 text-amber-300" />
                Режимы
              </div>
              <div className="mt-3 grid gap-3">
                {tankModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      setModeId(mode.id)
                      resetBattle(tankClassId, mode.id, mapId)
                    }}
                    className={[
                      "rounded-[1.4rem] border px-4 py-3 text-left transition",
                      mode.id === modeId ? "border-white/40 bg-white/14" : "border-white/10 bg-white/6 hover:bg-white/10",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{mode.name}</span>
                      <span className="text-xs text-slate-400">{mode.scoreToWin} фрагов</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{mode.description}</p>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-lg font-bold">
                <MapIcon className="size-5 text-cyan-300" />
                Карты
              </div>
              <div className="mt-3 grid gap-3">
                {tankMaps.map((map) => (
                  <button
                    key={map.id}
                    type="button"
                    onClick={() => {
                      setMapId(map.id)
                      resetBattle(tankClassId, modeId, map.id)
                    }}
                    className={[
                      "rounded-[1.4rem] border px-4 py-3 text-left transition",
                      map.id === mapId ? "border-white/40 bg-white/14" : "border-white/10 bg-white/6 hover:bg-white/10",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{map.name}</span>
                      <span className="text-xs text-slate-400">{map.obstacles.length} укрытий</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{map.description}</p>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-lg font-bold">
                <ShieldIcon className="size-5 text-orange-300" />
                Классы танков
              </div>
              <div className="mt-3 grid gap-3">
                {tankClasses.map((tankClass) => (
                  <button
                    key={tankClass.id}
                    type="button"
                    onClick={() => {
                      setTankClassId(tankClass.id)
                      resetBattle(tankClass.id, modeId, mapId)
                    }}
                    className={[
                      "rounded-[1.4rem] border px-4 py-3 text-left transition",
                      tankClass.id === tankClassId ? "border-white/40 bg-white/14" : "border-white/10 bg-white/6 hover:bg-white/10",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="h-4 w-4 rounded-full" style={{ background: tankClass.color }} />
                        <span className="font-semibold">{tankClass.name}</span>
                      </div>
                      {tankClass.id === tankClassId ? <SparklesIcon className="size-4 text-amber-300" /> : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{tankClass.description}</p>
                  </button>
                ))}
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
                  placeholder="convoy"
                />
                <Button
                  onClick={() => {
                    const nextRoomId = `tank-${roomId.trim() || "convoy"}-${modeId}-${mapId}`
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
                  <p className="text-sm text-slate-400">Пока вы один. Откройте эту же страницу на другом аккаунте и зайдите в ту же комнату.</p>
                ) : (
                  remotePlayers.map((player) => (
                    <div key={player.playerId} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div>
                        <p className="font-semibold">{player.displayName}</p>
                        <p className="text-xs text-slate-400">
                          {tankClasses.find((item) => item.id === player.fighterId)?.name ?? "Танк"}
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
                <CrosshairIcon className="size-5 text-rose-300" />
                Управление
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <p>`WASD` или стрелки двигают корпус и разворачивают ходовую.</p>
                <p>Мышь наводит башню, удержание или клик по полю стреляет.</p>
                <p>Игровой темп сделан медленнее и тяжелее, чем в арене героев.</p>
              </div>
            </Card>

            <Card className="border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-lg font-bold">
                <TargetIcon className="size-5 text-cyan-300" />
                Что уже есть
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <p>Отдельная онлайн-игра со своими комнатами, режимами, картами и классами танков.</p>
                <p>Раздельный поворот корпуса и башни, перезарядка, укрытия и тяжёлые размены по HP.</p>
                <p>Боты тоже играют как танки: едут, сводятся, стреляют и респавнятся.</p>
              </div>
            </Card>

            <Card className="border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-lg font-bold">
                <GaugeIcon className="size-5 text-emerald-300" />
                Текущий сетап
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <p>Класс: {currentClass.name}</p>
                <p>Карта: {currentMap.name}</p>
                <p>Режим: {currentMode.name}</p>
              </div>
            </Card>

            <Card className="border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-lg font-bold">
                <TimerIcon className="size-5 text-amber-300" />
                Важно
              </div>
              <p className="mt-3 text-sm text-slate-300">
                Буквальную копию `World of Tanks` я не делаю, но собрал отдельную оригинальную онлайн-танковую игру в этом жанровом духе, чтобы не копировать чужую игру один в один.
              </p>
            </Card>
          </div>
        </section>
      </div>

      <BottomNav active="game" />
    </main>
  )
}
