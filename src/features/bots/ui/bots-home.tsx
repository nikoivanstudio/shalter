"use client"

import {
  BotIcon,
  BrainCircuitIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  GripIcon,
  MessageSquareQuoteIcon,
  PlusIcon,
  RocketIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react"
import { useId, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { AccountStatusBadge } from "@/components/ui/account-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LogoutButton } from "@/features/auth/ui/logout-button"
import { useI18n } from "@/features/i18n/model/i18n-provider"
import { LanguageToggle } from "@/features/i18n/ui/language-toggle"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { buildEmblem, getEmblemTone } from "@/features/profile/lib/emblem"
import { ThemeToggle } from "@/features/theme/ui/theme-toggle"

type UserShort = {
  id: number
  firstName: string
  lastName: string | null
  email: string
  role: string
  avatarTone?: string | null
}

type BlockType =
  | "identity"
  | "goal"
  | "greeting"
  | "tone"
  | "knowledge"
  | "escalation"
  | "skill"
  | "guardrail"
  | "channel"

type BuilderBlock = {
  id: string
  type: BlockType
  title: string
  description: string
  value: string
  tone: string
  icon: typeof BotIcon
}

const BLOCK_LIBRARY: Record<BlockType, Omit<BuilderBlock, "id">> = {
  identity: {
    type: "identity",
    title: "Когда бот запускается",
    description: "Представляется и объясняет, в какой нише работает.",
    value: "Shalter Assist|Онлайн-сервис и продажи",
    tone: "from-sky-500 to-cyan-400",
    icon: BotIcon,
  },
  goal: {
    type: "goal",
    title: "Цель",
    description: "Формулирует, к какому действию бот ведёт клиента.",
    value: "Отвечать за 30 секунд, собирать заявки и доводить клиента до целевого действия.",
    tone: "from-indigo-500 to-blue-500",
    icon: RocketIcon,
  },
  greeting: {
    type: "greeting",
    title: "Сообщение",
    description: "Первая реплика в диалоге.",
    value: "Привет! Я помогу быстро подобрать решение, отвечу на вопросы и передам вас человеку, если потребуется.",
    tone: "from-emerald-500 to-teal-400",
    icon: MessageSquareQuoteIcon,
  },
  tone: {
    type: "tone",
    title: "Стиль ответа",
    description: "Как именно бот разговаривает.",
    value: "Дружелюбный, уверенный, без канцелярита.",
    tone: "from-fuchsia-500 to-pink-500",
    icon: SparklesIcon,
  },
  knowledge: {
    type: "knowledge",
    title: "Знания",
    description: "Темы, по которым бот должен отвечать уверенно.",
    value: "Тарифы, преимущества продукта, сценарии подключения, FAQ, ограничения, акции, ссылки на оплату",
    tone: "from-violet-500 to-purple-500",
    icon: BrainCircuitIcon,
  },
  escalation: {
    type: "escalation",
    title: "Передать менеджеру",
    description: "Правило, когда нужно подключить человека.",
    value: "Если клиент просит нестандартную скидку, договор, возврат или живого менеджера, бот сразу передаёт диалог человеку.",
    tone: "from-amber-500 to-orange-500",
    icon: WandSparklesIcon,
  },
  skill: {
    type: "skill",
    title: "Навык",
    description: "Отдельный рабочий сценарий бота.",
    value: "Отвечать на частые вопросы",
    tone: "from-lime-500 to-green-500",
    icon: SparklesIcon,
  },
  guardrail: {
    type: "guardrail",
    title: "Ограничение",
    description: "Рамка безопасности для ответов.",
    value: "Не придумывает цены и сроки",
    tone: "from-rose-500 to-red-500",
    icon: ShieldCheckIcon,
  },
  channel: {
    type: "channel",
    title: "Канал",
    description: "Где бот будет опубликован.",
    value: "Telegram",
    tone: "from-cyan-500 to-sky-500",
    icon: RocketIcon,
  },
}

const INITIAL_BLOCKS: BuilderBlock[] = [
  makeBlock("identity"),
  makeBlock("goal"),
  makeBlock("greeting"),
  makeBlock("tone"),
  makeBlock("knowledge"),
  makeBlock("skill"),
  makeBlock("skill"),
  makeBlock("guardrail"),
  makeBlock("channel"),
]

export function BotsHome({ user }: { user: UserShort }) {
  const { tr } = useI18n()
  const [blocks, setBlocks] = useState(INITIAL_BLOCKS)
  const [selectedBlockId, setSelectedBlockId] = useState(INITIAL_BLOCKS[0]?.id ?? "")
  const botNameId = useId()
  const nicheId = useId()
  const blockValueId = useId()

  const selectedBlock = blocks.find((block) => block.id === selectedBlockId) ?? blocks[0] ?? null

  const emblem = buildEmblem(user.firstName, user.lastName)
  const emblemTone = getEmblemTone(user.firstName, user.lastName, user.avatarTone)

  const botConfig = useMemo(() => {
    const identityBlock = blocks.find((block) => block.type === "identity")
    const [botName = "", niche = ""] = identityBlock?.value.split("|") ?? []

    return {
      name: botName.trim(),
      niche: niche.trim(),
      goal: blocks.find((block) => block.type === "goal")?.value.trim() ?? "",
      tone: blocks.find((block) => block.type === "tone")?.value.trim() ?? "",
      greeting: blocks.find((block) => block.type === "greeting")?.value.trim() ?? "",
      knowledge: blocks
        .filter((block) => block.type === "knowledge")
        .flatMap((block) =>
          block.value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        ),
      channels: blocks
        .filter((block) => block.type === "channel")
        .map((block) => block.value.trim())
        .filter(Boolean),
      skills: blocks
        .filter((block) => block.type === "skill")
        .map((block) => block.value.trim())
        .filter(Boolean),
      guardrails: blocks
        .filter((block) => block.type === "guardrail")
        .map((block) => block.value.trim())
        .filter(Boolean),
      escalation: blocks.find((block) => block.type === "escalation")?.value.trim() ?? "",
      flow: blocks.map((block) => ({
        type: block.type,
        title: block.title,
        value: block.value,
      })),
      handoffEnabled: true,
      analytics: {
        trackLeads: true,
        trackFallbacks: true,
        summaryWindow: "daily",
      },
    }
  }, [blocks])

  const configPreview = JSON.stringify(botConfig, null, 2)
  const filledBlocks = blocks.filter((block) => block.value.trim().length > 0).length
  const completionPercent = blocks.length === 0 ? 0 : Math.round((filledBlocks / blocks.length) * 100)

  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(configPreview)
      toast.success(tr("Конфиг бота скопирован"))
    } catch {
      toast.error("Не удалось скопировать конфиг")
    }
  }

  function addBlock(type: BlockType) {
    const nextBlock = makeBlock(type)
    setBlocks((prev) => [...prev, nextBlock])
    setSelectedBlockId(nextBlock.id)
  }

  function moveBlock(blockId: string, direction: "up" | "down") {
    setBlocks((prev) => {
      const index = prev.findIndex((block) => block.id === blockId)
      if (index === -1) {
        return prev
      }

      const targetIndex = direction === "up" ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev
      }

      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(targetIndex, 0, item)
      return next
    })
  }

  function removeBlock(blockId: string) {
    setBlocks((prev) => {
      const next = prev.filter((block) => block.id !== blockId)
      const fallback = next[0]?.id ?? ""
      setSelectedBlockId((current) => (current === blockId ? fallback : current))
      return next
    })
  }

  function updateBlockValue(blockId: string, value: string) {
    setBlocks((prev) => prev.map((block) => (block.id === blockId ? { ...block, value } : block)))
  }

  function updateIdentityField(field: "name" | "niche", value: string) {
    if (!selectedBlock || selectedBlock.type !== "identity") {
      return
    }

    const [currentName = "", currentNiche = ""] = selectedBlock.value.split("|")
    const nextName = field === "name" ? value : currentName
    const nextNiche = field === "niche" ? value : currentNiche
    updateBlockValue(selectedBlock.id, `${nextName}|${nextNiche}`)
  }

  const identityValues =
    selectedBlock?.type === "identity"
      ? (() => {
          const [name = "", niche = ""] = selectedBlock.value.split("|")
          return { name, niche }
        })()
      : { name: "", niche: "" }

  return (
    <main className="min-h-screen px-4 py-5 pb-28 sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="overflow-hidden rounded-[2rem] border border-white/50 bg-card/88 shadow-[0_20px_55px_-32px_rgba(15,23,42,0.48)] backdrop-blur-xl dark:border-white/8">
          <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
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
                      Соберите бота как в Scratch: из блоков, в нужном порядке, с живым предпросмотром.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <LanguageToggle />
                  <ThemeToggle />
                  <LogoutButton />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <HeroMetric eyebrow="Готовность" value={`${completionPercent}%`} description="Заполненность блоков" />
                <HeroMetric eyebrow="Сценарий" value={String(blocks.length)} description="Блоков в цепочке" />
                <HeroMetric eyebrow="Навыки" value={String(botConfig.skills.length)} description="Отдельных навыков" />
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/20 bg-linear-to-br from-primary/16 via-background to-background p-5">
              <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-primary/12 blur-3xl" />
              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">Flow Preview</p>
                <div className="mt-4 rounded-[1.5rem] border border-border/60 bg-background/75 p-4 shadow-sm backdrop-blur">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                      <BotIcon className="size-5" />
                    </div>
                    <div>
                      <p className="text-base font-semibold">{botConfig.name || "Без названия"}</p>
                      <p className="text-sm text-muted-foreground">{botConfig.niche || "Укажите нишу"}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    Блоки ниже управляют тем, как бот представляется, отвечает и когда передаёт диалог человеку.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <Card className="border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
            <CardHeader className="border-b border-border/55 pb-4">
              <CardTitle className="text-lg">Палитра блоков</CardTitle>
              <CardDescription>Добавляйте команды в сценарий, как в Scratch.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-5">
              <PaletteButton type="identity" label="Старт" onAdd={addBlock} />
              <PaletteButton type="goal" label="Цель" onAdd={addBlock} />
              <PaletteButton type="greeting" label="Сообщение" onAdd={addBlock} />
              <PaletteButton type="tone" label="Стиль" onAdd={addBlock} />
              <PaletteButton type="knowledge" label="Знания" onAdd={addBlock} />
              <PaletteButton type="skill" label="Навык" onAdd={addBlock} />
              <PaletteButton type="guardrail" label="Ограничение" onAdd={addBlock} />
              <PaletteButton type="escalation" label="Передать" onAdd={addBlock} />
              <PaletteButton type="channel" label="Канал" onAdd={addBlock} />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
            <CardHeader className="border-b border-border/55 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Сценарий бота</CardTitle>
                  <CardDescription>Переставляйте блоки вверх и вниз, чтобы собрать логику.</CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={copyConfig}>
                  <CopyIcon className="size-4" />
                  Скопировать конфиг
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="space-y-3">
                {blocks.map((block, index) => (
                  <ScratchBlock
                    key={block.id}
                    block={block}
                    index={index}
                    isSelected={block.id === selectedBlockId}
                    onSelect={() => setSelectedBlockId(block.id)}
                    onMoveUp={() => moveBlock(block.id, "up")}
                    onMoveDown={() => moveBlock(block.id, "down")}
                    onRemove={() => removeBlock(block.id)}
                  />
                ))}
                {blocks.length === 0 && (
                  <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/55 px-4 py-8 text-center text-sm text-muted-foreground">
                    Сценарий пуст. Добавьте первый блок слева.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="overflow-hidden border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
              <CardHeader className="border-b border-border/55 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GripIcon className="size-5" />
                  Инспектор блока
                </CardTitle>
                <CardDescription>Редактируйте выбранный блок справа.</CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                {selectedBlock ? (
                  <div className="space-y-4">
                    <div className={`rounded-[1.4rem] bg-linear-to-r ${selectedBlock.tone} p-[1px]`}>
                      <div className="rounded-[calc(1.4rem-1px)] bg-background/95 p-4">
                        <p className="text-sm font-semibold">{selectedBlock.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{selectedBlock.description}</p>
                      </div>
                    </div>

                    {selectedBlock.type === "identity" ? (
                      <div className="space-y-4">
                        <FieldShell label="Имя бота" htmlFor={botNameId}>
                          <Input
                            id={botNameId}
                            value={identityValues.name}
                            onChange={(event) => updateIdentityField("name", event.target.value)}
                          />
                        </FieldShell>
                        <FieldShell label="Ниша" htmlFor={nicheId}>
                          <Input
                            id={nicheId}
                            value={identityValues.niche}
                            onChange={(event) => updateIdentityField("niche", event.target.value)}
                          />
                        </FieldShell>
                      </div>
                    ) : (
                      <FieldShell label="Содержимое блока" htmlFor={blockValueId}>
                        <textarea
                          id={blockValueId}
                          className="min-h-32 w-full rounded-[1.2rem] border border-input bg-background/82 px-4 py-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          value={selectedBlock.value}
                          onChange={(event) => updateBlockValue(selectedBlock.id, event.target.value)}
                        />
                      </FieldShell>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Выберите блок из сценария, чтобы редактировать его.</p>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
              <CardHeader className="border-b border-border/55 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BotIcon className="size-5" />
                  Предпросмотр бота
                </CardTitle>
                <CardDescription>Сценарий справа сразу складывается в рабочий профиль.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="rounded-[1.6rem] border border-primary/20 bg-linear-to-br from-primary/12 via-background to-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{botConfig.name || "Без названия"}</p>
                      <p className="text-sm text-muted-foreground">{botConfig.niche || "Ниша не указана"}</p>
                    </div>
                    <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      Блочный режим
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6">{botConfig.goal || "Цель пока не задана"}</p>
                </div>

                <div className="rounded-[1.5rem] border border-border/70 bg-background/78 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquareQuoteIcon className="size-4" />
                    Первое сообщение
                  </p>
                  <p className="mt-3 rounded-[1.25rem] bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm">
                    {botConfig.greeting || "Приветствие пока пустое"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoStack title="Каналы" items={botConfig.channels} />
                  <InfoStack title="Навыки" items={botConfig.skills} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
              <CardHeader className="border-b border-border/55 pb-4">
                <CardTitle className="text-lg">JSON-конфиг</CardTitle>
                <CardDescription>Можно сразу передать в API или интегратор.</CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <pre className="max-h-[24rem] overflow-auto rounded-[1.4rem] border border-border/70 bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                  <code>{configPreview}</code>
                </pre>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      <BottomNav active="bots" />
    </main>
  )
}

function makeBlock(type: BlockType): BuilderBlock {
  const template = BLOCK_LIBRARY[type]

  return {
    ...template,
    id: `${type}-${Math.random().toString(36).slice(2, 10)}`,
  }
}

function HeroMetric({
  eyebrow,
  value,
  description,
}: {
  eyebrow: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-[1.35rem] border border-border/60 bg-background/65 p-4 backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function PaletteButton({
  type,
  label,
  onAdd,
}: {
  type: BlockType
  label: string
  onAdd: (type: BlockType) => void
}) {
  const template = BLOCK_LIBRARY[type]
  const Icon = template.icon

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onAdd(type)}
      className={`w-full rounded-[1.45rem] bg-linear-to-r ${template.tone} p-[1px] text-left transition-transform hover:-translate-y-0.5`}
    >
      <div className="flex items-center justify-between rounded-[calc(1.45rem-1px)] bg-background/92 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-2xl bg-muted">
            <Icon className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground">{template.title}</p>
          </div>
        </div>
        <PlusIcon className="size-4 text-muted-foreground" />
      </div>
    </button>
  )
}

function ScratchBlock({
  block,
  index,
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  block: BuilderBlock
  index: number
  isSelected: boolean
  onSelect: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  const Icon = block.icon

  return (
    <div className={`rounded-[1.55rem] bg-linear-to-r ${block.tone} p-[1px] shadow-sm`}>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full flex-col rounded-[calc(1.55rem-1px)] px-4 py-4 text-left transition ${
          isSelected ? "bg-background/96 ring-2 ring-primary/25" : "bg-background/90 hover:bg-background/96"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Блок {index + 1}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{block.type}</span>
              </div>
              <p className="mt-1 text-sm font-semibold">{block.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{block.value}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconButton label="Вверх" onClick={onMoveUp} icon={<ChevronUpIcon className="size-4" />} />
            <IconButton label="Вниз" onClick={onMoveDown} icon={<ChevronDownIcon className="size-4" />} />
            <IconButton label="Удалить" onClick={onRemove} icon={<Trash2Icon className="size-4" />} />
          </div>
        </div>
      </button>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  icon,
}: {
  label: string
  onClick: () => void
  icon: ReactNode
}) {
  return (
    <span
      role="button"
      aria-label={label}
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          event.stopPropagation()
          onClick()
        }
      }}
      className="flex size-8 items-center justify-center rounded-full border border-border/70 bg-background/90 text-muted-foreground transition hover:bg-accent hover:text-foreground"
    >
      {icon}
    </span>
  )
}

function FieldShell({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode
  htmlFor: string
  label: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function InfoStack({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[1.3rem] border border-border/70 bg-background/78 p-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span
            key={`${title}-${index}-${item}`}
            className="inline-flex rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
