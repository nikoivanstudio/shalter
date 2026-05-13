"use client"

import {
  BoxIcon,
  CrownIcon,
  JoystickIcon,
  MapIcon,
  Move3DIcon,
  RadioTowerIcon,
  ShieldIcon,
  ShoppingBagIcon,
  SparklesIcon,
  SwordsIcon,
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

type GameMode = {
  id: string
  name: string
  description: string
  botCount: number
  scoreToWin: number
  scorePerBot: number
  playerPenaltyOnDeath: number
  superGainPerHit: number
}

type ArenaMap = {
  id: string
  name: string
  description: string
  tint: string
  obstacles: Array<{
    id: string
    x: number
    y: number
    width: number
    height: number
    height3d: number
  }>
  spawns: Array<{ x: number; y: number }>
}

type ShopItem = {
  id: string
  name: string
  price: number
  description: string
  effect: "coins" | "heal" | "damage" | "unlock"
  value: number
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

const modes: GameMode[] = [
  {
    id: "solo",
    name: "Соло бой",
    description: "Классический режим против ботов. Победа по фрагам.",
    botCount: 4,
    scoreToWin: 10,
    scorePerBot: 1,
    playerPenaltyOnDeath: 1,
    superGainPerHit: 16,
  },
  {
    id: "survival",
    name: "Выживание",
    description: "Больше врагов, меньше права на ошибку, быстрый темп матча.",
    botCount: 6,
    scoreToWin: 16,
    scorePerBot: 2,
    playerPenaltyOnDeath: 2,
    superGainPerHit: 14,
  },
  {
    id: "bossrush",
    name: "Босс раш",
    description: "Меньше врагов, но они толще и стреляют больнее.",
    botCount: 3,
    scoreToWin: 12,
    scorePerBot: 3,
    playerPenaltyOnDeath: 1,
    superGainPerHit: 20,
  },
]

const maps: ArenaMap[] = [
  {
    id: "neon-dunes",
    name: "Неоновые дюны",
    description: "Открытая карта с дальними прострелами и быстрыми разворотами.",
    tint: "linear-gradient(180deg,rgba(14,165,233,0.16),rgba(15,23,42,0.96))",
    spawns: [
      { x: 100, y: 100 },
      { x: 760, y: 110 },
      { x: 150, y: 420 },
      { x: 748, y: 410 },
      { x: 445, y: 80 },
      { x: 448, y: 452 },
    ],
    obstacles: [
      { id: "o1", x: 180, y: 120, width: 110, height: 56, height3d: 44 },
      { id: "o2", x: 520, y: 110, width: 140, height: 62, height3d: 56 },
      { id: "o3", x: 312, y: 280, width: 96, height: 86, height3d: 52 },
      { id: "o4", x: 660, y: 314, width: 132, height: 54, height3d: 46 },
    ],
  },
  {
    id: "crystal-port",
    name: "Кристальный порт",
    description: "Более плотная карта, где важны углы, укрытия и фланги.",
    tint: "linear-gradient(180deg,rgba(16,185,129,0.18),rgba(15,23,42,0.96))",
    spawns: [
      { x: 120, y: 90 },
      { x: 760, y: 92 },
      { x: 130, y: 446 },
      { x: 740, y: 430 },
      { x: 445, y: 120 },
      { x: 448, y: 430 },
    ],
    obstacles: [
      { id: "c1", x: 150, y: 150, width: 148, height: 48, height3d: 46 },
      { id: "c2", x: 582, y: 150, width: 148, height: 48, height3d: 46 },
      { id: "c3", x: 348, y: 120, width: 120, height: 54, height3d: 54 },
      { id: "c4", x: 348, y: 342, width: 120, height: 54, height3d: 54 },
      { id: "c5", x: 220, y: 306, width: 92, height: 70, height3d: 46 },
      { id: "c6", x: 568, y: 306, width: 92, height: 70, height3d: 46 },
    ],
  },
  {
    id: "volcano-core",
    name: "Ядро вулкана",
    description: "Компактная карта для плотных заруб и постоянных стычек.",
    tint: "linear-gradient(180deg,rgba(239,68,68,0.16),rgba(15,23,42,0.96))",
    spawns: [
      { x: 140, y: 150 },
      { x: 730, y: 150 },
      { x: 160, y: 392 },
      { x: 720, y: 386 },
      { x: 436, y: 84 },
      { x: 440, y: 456 },
    ],
    obstacles: [
      { id: "v1", x: 246, y: 110, width: 108, height: 58, height3d: 48 },
      { id: "v2", x: 520, y: 110, width: 108, height: 58, height3d: 48 },
      { id: "v3", x: 246, y: 352, width: 108, height: 58, height3d: 48 },
      { id: "v4", x: 520, y: 352, width: 108, height: 58, height3d: 48 },
      { id: "v5", x: 380, y: 210, width: 118, height: 116, height3d: 60 },
    ],
  },
]

const shopItems: ShopItem[] = [
  {
    id: "coin-pack",
    name: "Пакет монет",
    price: 40,
    description: "Мгновенно даёт +120 монет для покупок и боксов.",
    effect: "coins",
    value: 120,
  },
  {
    id: "med-stim",
    name: "Мед-стим",
    price: 60,
    description: "Полностью лечит бойца в текущем матче.",
    effect: "heal",
    value: 999,
  },
  {
    id: "damage-chip",
    name: "Чип урона",
    price: 90,
    description: "Даёт +2 к урону текущему бойцу до смены режима.",
    effect: "damage",
    value: 2,
  },
  {
    id: "unlock-token",
    name: "Токен разблокировки",
    price: 180,
    description: "Открывает случайного закрытого бойца.",
    effect: "unlock",
    value: 1,
  },
]

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "")
}

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

function distance(leftX: number, leftY: number, rightX: number, rightY: number) {
  return Math.hypot(leftX - rightX, leftY - rightY)
}

function collidesWithObstacle(x: number, y: number, radius: number, currentMap: ArenaMap) {
  return currentMap.obstacles.some((obstacle) => {
    const closestX = clamp(x, obstacle.x, obstacle.x + obstacle.width)
    const closestY = clamp(y, obstacle.y, obstacle.y + obstacle.height)
    return distance(x, y, closestX, closestY) < radius
  })
}

function randomSpawn(currentMap: ArenaMap, index = 0) {
  return currentMap.spawns[index % currentMap.spawns.length]
}

function createBot(index: number, currentMap: ArenaMap, currentMode: GameMode): BotState {
  const definition = fighters[(index + 1) % fighters.length]
  const spawn = randomSpawn(currentMap, index + 1)
  const hpBoost = currentMode.id === "bossrush" ? 1.45 : 1

  return {
    id: `bot-${index + 1}`,
    name: `${definition.name} ${index + 1}`,
    x: spawn.x,
    y: spawn.y,
    hp: Math.round(definition.maxHp * hpBoost),
    maxHp: Math.round(definition.maxHp * hpBoost),
    color: definition.color,
    angle: 0,
    fighterId: definition.id,
    nextShotAt: 0,
    respawnAt: 0,
  }
}

function createInitialWorld(fighter: FighterDefinition, currentMap: ArenaMap, currentMode: GameMode): WorldView {
  const spawn = randomSpawn(currentMap, 0)

  return {
    localPlayer: {
      id: "local",
      name: "Вы",
      x: spawn.x,
      y: spawn.y,
      hp: fighter.maxHp,
      maxHp: fighter.maxHp,
      color: fighter.color,
      angle: 0,
      fighterId: fighter.id,
    },
    bots: Array.from({ length: currentMode.botCount }, (_, index) => createBot(index, currentMap, currentMode)),
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
  const [modeId, setModeId] = useState(modes[0].id)
  const [mapId, setMapId] = useState(maps[0].id)
  const [roomId, setRoomId] = useState("arena")
  const [joinedRoomId, setJoinedRoomId] = useState("arena")
  const [coins, setCoins] = useState(isSpecialAccount ? 900 : 220)
  const [boxes, setBoxes] = useState(isSpecialAccount ? 6 : 2)
  const [damageBoost, setDamageBoost] = useState(0)
  const [unlockedFighterIds, setUnlockedFighterIds] = useState<string[]>(
    isSpecialAccount ? fighters.map((item) => item.id) : [fighters[0].id]
  )
  const [selectedFighterId, setSelectedFighterId] = useState(fighters[0].id)
  const [remotePlayers, setRemotePlayers] = useState<RemoteSnapshot[]>([])

  const currentMode = useMemo(
    () => modes.find((item) => item.id === modeId) ?? modes[0],
    [modeId]
  )
  const currentMap = useMemo(
    () => maps.find((item) => item.id === mapId) ?? maps[0],
    [mapId]
  )
  const fighter = useMemo(
    () => fighters.find((item) => item.id === selectedFighterId) ?? fighters[0],
    [selectedFighterId]
  )
  const [view, setView] = useState<WorldView>(() => createInitialWorld(fighter, currentMap, currentMode))

  const viewRef = useRef(view)
  const controlsRef = useRef<ControlState>({ up: false, down: false, left: false, right: false, fire: false })
  const aimRef = useRef({ x: ARENA_WIDTH - 120, y: ARENA_HEIGHT / 2 })
  const dashReadyAtRef = useRef(0)
  const nextShotAtRef = useRef(0)
  const superReadyRef = useRef(false)
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const resetArena = useCallback((nextFighterId = selectedFighterId, nextModeId = modeId, nextMapId = mapId) => {
    const nextFighter = fighters.find((item) => item.id === nextFighterId) ?? fighters[0]
    const nextMode = modes.find((item) => item.id === nextModeId) ?? modes[0]
    const nextMap = maps.find((item) => item.id === nextMapId) ?? maps[0]
    const nextWorld = createInitialWorld(nextFighter, nextMap, nextMode)
    nextWorld.remotePlayers = viewRef.current.remotePlayers

    setView(nextWorld)
    viewRef.current = nextWorld
    nextShotAtRef.current = 0
    dashReadyAtRef.current = 0
    superReadyRef.current = false
    setDamageBoost(0)
  }, [mapId, modeId, selectedFighterId])

  function applyFighterSelection(nextFighterId: string) {
    setSelectedFighterId(nextFighterId)
    resetArena(nextFighterId, modeId, mapId)
  }

  function applyModeSelection(nextModeId: string) {
    setModeId(nextModeId)
    resetArena(selectedFighterId, nextModeId, mapId)
  }

  function applyMapSelection(nextMapId: string) {
    setMapId(nextMapId)
    resetArena(selectedFighterId, modeId, nextMapId)
  }

  function unlockRandomFighter() {
    const locked = fighters.filter((item) => !unlockedFighterIds.includes(item.id))
    if (locked.length === 0) {
      setCoins((current) => current + 50)
      toast.success("Все бойцы уже открыты. Получено 50 монет компенсации.")
      return
    }

    const reward = locked[randomInt(locked.length)]
    setUnlockedFighterIds((current) => [...current, reward.id])
    toast.success(`Открыт новый боец: ${reward.name}`)
  }

  function openBox() {
    if (boxes <= 0 && coins < 80) {
      toast.error("Нужен хотя бы один бокс или 80 монет для покупки.")
      return
    }

    if (boxes > 0) {
      setBoxes((current) => current - 1)
    } else {
      setCoins((current) => current - 80)
    }

    const roll = randomFraction()
    if (roll < 0.34) {
      const reward = 60 + randomInt(90)
      setCoins((current) => current + reward)
      toast.success(`Из бокса выпало ${reward} монет`)
      return
    }

    if (roll < 0.68) {
      unlockRandomFighter()
      return
    }

    const rewardBoxes = 1 + randomInt(2)
    setBoxes((current) => current + rewardBoxes)
    toast.success(`Бонусные боксы: +${rewardBoxes}`)
  }

  function buyShopItem(item: ShopItem) {
    if (coins < item.price) {
      toast.error("Не хватает монет для покупки.")
      return
    }

    setCoins((current) => current - item.price)

    if (item.effect === "coins") {
      setCoins((current) => current + item.value)
      toast.success(`Куплено: ${item.name}`)
      return
    }

    if (item.effect === "heal") {
      setView((current) => {
        const next = {
          ...current,
          localPlayer: { ...current.localPlayer, hp: current.localPlayer.maxHp },
        }
        viewRef.current = next
        return next
      })
      toast.success("Здоровье восстановлено полностью.")
      return
    }

    if (item.effect === "damage") {
      setDamageBoost((current) => current + item.value)
      toast.success("Урон бойца увеличен.")
      return
    }

    unlockRandomFighter()
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
          if (!collidesWithObstacle(nextX, nextY, PLAYER_RADIUS, currentMap)) {
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
  }, [fighter, currentMap])

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
    let previousAt = 0

    const tick = (now: number) => {
      if (previousAt === 0) {
        previousAt = now
      }
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

        if (!collidesWithObstacle(nextX, nextY, PLAYER_RADIUS, currentMap)) {
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
          damage: (fighter.damage + damageBoost) * (current.superActiveUntil > Date.now() ? 1.2 : 1),
          color: fighter.color,
        })
        nextShotAtRef.current = Date.now() + fighter.fireDelayMs
      }

      for (const bot of current.bots) {
        const botFighter = fighters.find((item) => item.id === bot.fighterId) ?? fighters[0]

        if (bot.hp <= 0) {
          if (bot.respawnAt > 0 && bot.respawnAt <= Date.now()) {
            const spawnIndex = Number(bot.id.replace("bot-", "")) + 1
            const spawn = randomSpawn(currentMap, spawnIndex)
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
          const rushMultiplier = currentMode.id === "survival" ? 3.3 : 2.6
          const nextX = clamp(bot.x + (directionX / magnitude) * botFighter.speed * rushMultiplier, BOT_RADIUS, ARENA_WIDTH - BOT_RADIUS)
          const nextY = clamp(bot.y + (directionY / magnitude) * botFighter.speed * rushMultiplier, BOT_RADIUS, ARENA_HEIGHT - BOT_RADIUS)
          if (!collidesWithObstacle(nextX, nextY, BOT_RADIUS, currentMap)) {
            bot.x = nextX
            bot.y = nextY
          }
        }

        if (distanceToPlayer < 320 && bot.nextShotAt <= Date.now()) {
          const damageMultiplier = currentMode.id === "bossrush" ? 1.25 : 0.9
          current.projectiles.push({
            id: `${bot.id}-${Date.now()}`,
            ownerId: bot.id,
            x: bot.x,
            y: bot.y,
            vx: Math.cos(bot.angle) * botFighter.projectileSpeed * 0.9,
            vy: Math.sin(bot.angle) * botFighter.projectileSpeed * 0.9,
            damage: botFighter.damage * damageMultiplier,
            color: bot.color,
          })
          bot.nextShotAt = Date.now() + botFighter.fireDelayMs + (currentMode.id === "survival" ? 120 : 250)
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
          collidesWithObstacle(projectile.x, projectile.y, PROJECTILE_RADIUS, currentMap)
        ) {
          return false
        }

        if (projectile.ownerId !== current.localPlayer.id) {
          const hitLocal = distance(projectile.x, projectile.y, current.localPlayer.x, current.localPlayer.y) < PLAYER_RADIUS
          if (hitLocal) {
            current.localPlayer.hp = Math.max(0, current.localPlayer.hp - projectile.damage)
            if (current.localPlayer.hp === 0) {
              current.score = Math.max(0, current.score - currentMode.playerPenaltyOnDeath)
              const spawn = randomSpawn(currentMap, 0)
              current.localPlayer.hp = current.localPlayer.maxHp
              current.localPlayer.x = spawn.x
              current.localPlayer.y = spawn.y
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
            current.superCharge = clamp(current.superCharge + currentMode.superGainPerHit, 0, 100)
            if (bot.hp === 0) {
              bot.respawnAt = Date.now() + (currentMode.id === "survival" ? 1500 : 2200)
              current.score += currentMode.scorePerBot
              current.superCharge = clamp(current.superCharge + 28, 0, 100)
              setCoins((value) => value + 15)
            }
            return false
          }
        }

        return true
      })

      if (current.score >= currentMode.scoreToWin) {
        setCoins((value) => value + 60)
        setBoxes((value) => value + 1)
        toast.success(`Победа в режиме «${currentMode.name}». Получено 60 монет и 1 бокс.`)
        resetArena(selectedFighterId, modeId, mapId)
        frameId = window.requestAnimationFrame(tick)
        return
      }

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
  }, [fighter, currentMap, currentMode, remotePlayers, damageBoost, mapId, modeId, resetArena, selectedFighterId])

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
                    Теперь внутри вкладки есть режимы, карты, магазин и боксы. Всё это влияет на матч, а не просто висит отдельным меню.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Link
                    href="/game/tanks"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "border-white/15 bg-white/5 text-white"
                    )}
                  >
                    <JoystickIcon className="size-4" />
                    Танковый бой
                  </Link>
                  <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-cyan-100">
                    Игрок: {displayName}
                  </span>
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-emerald-100">
                    Онлайн: {remotePlayers.length + 1}
                  </span>
                  <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-amber-100">
                    Монеты: {coins}
                  </span>
                  <span className="rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-3 py-1 text-fuchsia-100">
                    Боксы: {boxes}
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
                  {currentMap.obstacles.map((obstacle) => (
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
                    Счёт: {view.score}/{currentMode.scoreToWin}
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
                        if (!collidesWithObstacle(nextX, nextY, PLAYER_RADIUS, currentMap)) {
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
                <TrophyIcon className="size-5 text-amber-300" />
                Режимы
              </div>
              <div className="mt-3 grid gap-3">
                {modes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => applyModeSelection(mode.id)}
                    className={[
                      "rounded-[1.4rem] border px-4 py-3 text-left transition",
                      mode.id === modeId ? "border-white/40 bg-white/14" : "border-white/10 bg-white/6 hover:bg-white/10",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{mode.name}</span>
                      <span className="text-xs text-slate-400">{mode.scoreToWin} очков</span>
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
                {maps.map((map) => (
                  <button
                    key={map.id}
                    type="button"
                    onClick={() => applyMapSelection(map.id)}
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
                <SwordsIcon className="size-5 text-rose-300" />
                Бойцы
              </div>
              <div className="mt-3 grid gap-3">
                {fighters.map((item) => {
                  const unlocked = unlockedFighterIds.includes(item.id)
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
                {isSpecialAccount ? (
                  <p className="text-sm text-amber-200">Для номера {phone} все бойцы уже открыты.</p>
                ) : null}
              </div>
            </Card>

            <Card className="border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-lg font-bold">
                <ShoppingBagIcon className="size-5 text-emerald-300" />
                Магазин
              </div>
              <div className="mt-3 grid gap-3">
                {shopItems.map((item) => (
                  <div key={item.id} className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-xs text-amber-200">{item.price} монет</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                    <Button className="mt-3 w-full" onClick={() => buyShopItem(item)}>
                      Купить
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-lg font-bold">
                <BoxIcon className="size-5 text-fuchsia-300" />
                Боксы
              </div>
              <p className="mt-3 text-sm text-slate-300">
                Бокс может дать монеты, бонусные боксы или нового бойца. Если боксов нет, можно открыть за 80 монет.
              </p>
              <div className="mt-4 flex gap-2">
                <Button className="flex-1" onClick={openBox}>
                  Открыть бокс
                </Button>
                <Button
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white"
                  onClick={() => {
                    if (coins < 80) {
                      toast.error("Не хватает монет на покупку бокса.")
                      return
                    }
                    setCoins((current) => current - 80)
                    setBoxes((current) => current + 1)
                    toast.success("Куплен 1 бокс.")
                  }}
                >
                  Купить бокс
                </Button>
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
                    const nextRoomId = (roomId.trim() || "arena") + `-${modeId}-${mapId}`
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
                  <p className="text-sm text-slate-400">Пока вы один в комнате. Откройте игру на другом аккаунте и войдите в тот же режим и ту же карту.</p>
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
                <SparklesIcon className="size-5 text-amber-300" />
                Что уже работает
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <p>Режимы меняют количество врагов, темп матча и награды.</p>
                <p>Карты реально меняют спавны, укрытия и визуальный тон арены.</p>
                <p>Магазин усиливает текущего бойца, а боксы развивают аккаунт.</p>
              </div>
            </Card>
          </div>
        </section>
      </div>

      <BottomNav active="game" />
    </main>
  )
}
