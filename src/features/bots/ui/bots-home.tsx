"use client"

import { BotIcon, MessageCircleIcon, PlusIcon, SendIcon, Trash2Icon } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  type BotChatMessage,
  type BotConfig,
  buildBotReply,
  createInitialBotMessages,
} from "@/features/bots/lib/runtime"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"

type BotUser = {
  id: number
  email: string
  firstName: string
  lastName: string | null
  role: string
  avatarTone?: string | null
}

type PublishedBot = {
  id: number
  name: string
  niche: string | null
  audience: "client" | "user"
  publishedAt: string
  config: BotConfig
}

type FlowBlock = {
  id: string
  type: string
  title: string
  value: string
}

type BlockTemplate = {
  type: string
  title: string
  badge: string
  description: string
  defaultValue: string
}

export type BotsHomeProps = {
  user: BotUser
  publishedBots?: PublishedBot[]
}

const blockLibrary: BlockTemplate[] = [
  {
    type: "greeting",
    title: "Первый ответ",
    badge: "Навык",
    description: "Как бот встречает пользователя и задаёт первый вектор диалога.",
    defaultValue: "Поздороваться, быстро понять запрос и предложить следующий шаг.",
  },
  {
    type: "qualification",
    title: "Квалификация",
    badge: "Продажи",
    description: "Какие данные бот уточняет перед предложением решения.",
    defaultValue: "Уточнить нишу, бюджет, сроки, команду и текущую задачу клиента.",
  },
  {
    type: "faq",
    title: "Частые вопросы",
    badge: "Поддержка",
    description: "Отдельный блок для шаблонных ответов и FAQ-сценариев.",
    defaultValue: "Отвечать по тарифам, срокам запуска, интеграциям и ограничениям продукта.",
  },
  {
    type: "objections",
    title: "Возражения",
    badge: "Продажи",
    description: "Как бот снимает сомнения и возвращает пользователя к целевому действию.",
    defaultValue: "Если дорого или непонятно, объяснить выгоду, кейсы и предложить демо.",
  },
  {
    type: "lead_capture",
    title: "Сбор лида",
    badge: "CRM",
    description: "Что бот должен собрать перед передачей менеджеру.",
    defaultValue: "Собрать имя, телефон, Telegram, компанию и краткое описание задачи.",
  },
  {
    type: "follow_up",
    title: "Дожим",
    badge: "Retention",
    description: "Повторный контакт, если пользователь не завершил сценарий.",
    defaultValue: "Если пользователь ушёл без заявки, предложить вернуться и оставить контакт.",
  },
  {
    type: "integration",
    title: "Интеграции",
    badge: "Ops",
    description: "Что бот отправляет во внешние системы и когда.",
    defaultValue: "Передавать лиды в CRM, а важные диалоги отправлять в Telegram команде.",
  },
  {
    type: "analytics",
    title: "Аналитика",
    badge: "Data",
    description: "Какие события бот должен считать и помечать.",
    defaultValue: "Отмечать лиды, фолбэки, брошенные диалоги и успешные конверсии.",
  },
  {
    type: "guardrail",
    title: "Ограничения",
    badge: "Безопасность",
    description: "Что бот не должен обещать, придумывать или делать.",
    defaultValue: "Не придумывать цены, сроки и юридические обещания без подтверждения.",
  },
  {
    type: "handoff",
    title: "Передача человеку",
    badge: "Support",
    description: "Когда бот должен сразу отдать диалог менеджеру или оператору.",
    defaultValue: "Передавать менеджеру при нестандартных условиях, оплате и конфликтных вопросах.",
  },
]

const audienceLabels: Record<PublishedBot["audience"], string> = {
  client: "Клиенты",
  user: "Пользователи",
}

const defaultBlocks: FlowBlock[] = [
  {
    id: "greeting-1",
    type: "greeting",
    title: "Первый ответ",
    value: "Поздороваться, быстро понять запрос и предложить следующий шаг.",
  },
  {
    id: "qualification-1",
    type: "qualification",
    title: "Квалификация",
    value: "Уточнить контекст, бюджет, сроки и приоритеты клиента.",
  },
  {
    id: "lead-capture-1",
    type: "lead_capture",
    title: "Сбор лида",
    value: "Собрать контакт и кратко описать задачу перед передачей менеджеру.",
  },
]

function toList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildConfig(name: string, niche: string, blocks: FlowBlock[]): BotConfig {
  return {
    name,
    niche,
    goal:
      blocks.find((block) => block.type === "qualification")?.value ||
      "Помогать пользователям и доводить их до результата.",
    tone: "Спокойный, уверенный, дружелюбный.",
    greeting:
      blocks.find((block) => block.type === "greeting")?.value ||
      "Здравствуйте! Чем могу помочь?",
    knowledge: toList(
      blocks
        .filter((block) => block.type === "faq" || block.type === "integration")
        .map((block) => block.value)
        .join("\n")
    ),
    channels: ["Web chat", "Telegram", "CRM"],
    skills: blocks.map((block) => block.title),
    guardrails: toList(
      blocks
        .filter((block) => block.type === "guardrail")
        .map((block) => block.value)
        .join("\n")
    ),
    escalation:
      blocks.find((block) => block.type === "handoff")?.value ||
      "Передавать диалог человеку при сложных кейсах.",
    flow: blocks.map((block) => ({
      type: block.type,
      title: block.title,
      value: block.value,
    })),
    handoffEnabled: blocks.some((block) => block.type === "handoff"),
    analytics: {
      trackLeads: blocks.some((block) => block.type === "lead_capture"),
      trackFallbacks: true,
      summaryWindow: "7d",
    },
  }
}

function createBlock(template: BlockTemplate) {
  return {
    id: `${template.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: template.type,
    title: template.title,
    value: template.defaultValue,
  } satisfies FlowBlock
}

function createUserMessage(content: string): BotChatMessage {
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: "user",
    content,
  }
}

function createBotMessage(content: string): BotChatMessage {
  return {
    id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: "bot",
    content,
  }
}

export function BotsHome({ user, publishedBots = [] }: BotsHomeProps) {
  const [name, setName] = useState("Новый бот")
  const [niche, setNiche] = useState("")
  const [audience, setAudience] = useState<PublishedBot["audience"]>("client")
  const [items, setItems] = useState<PublishedBot[]>(publishedBots)
  const [blocks, setBlocks] = useState<FlowBlock[]>(defaultBlocks)
  const [selectedBotId, setSelectedBotId] = useState<number | null>(publishedBots[0]?.id ?? null)
  const [botDraft, setBotDraft] = useState("")
  const [botMessagesById, setBotMessagesById] = useState<Record<number, BotChatMessage[]>>({})
  const [isPublishing, startPublishing] = useTransition()
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null)

  const previewConfig = useMemo(
    () => buildConfig(name.trim() || "Новый бот", niche.trim(), blocks),
    [blocks, name, niche]
  )

  const selectedBot =
    items.find((item) => item.id === selectedBotId) ?? items[0] ?? null

  useEffect(() => {
    if (items.length === 0) {
      setSelectedBotId(null)
      return
    }

    setSelectedBotId((prev) => (prev && items.some((item) => item.id === prev) ? prev : items[0].id))
  }, [items])

  useEffect(() => {
    setBotMessagesById((prev) => {
      const next = { ...prev }

      for (const bot of items) {
        if (!next[bot.id]) {
          next[bot.id] = createInitialBotMessages(bot.config)
        }
      }

      for (const key of Object.keys(next)) {
        const botId = Number(key)
        if (!items.some((item) => item.id === botId)) {
          delete next[botId]
        }
      }

      return next
    })
  }, [items])

  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(previewConfig, null, 2))
      toast.success("Конфиг скопирован")
    } catch {
      toast.error("Не удалось скопировать конфиг")
    }
  }

  function addBlock(template: BlockTemplate) {
    setBlocks((prev) => [...prev, createBlock(template)])
  }

  function updateBlock(blockId: string, value: string) {
    setBlocks((prev) => prev.map((block) => (block.id === blockId ? { ...block, value } : block)))
  }

  function removeBlock(blockId: string) {
    setBlocks((prev) => prev.filter((block) => block.id !== blockId))
  }

  function publishBot() {
    startPublishing(async () => {
      const response = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          config: previewConfig,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "Не удалось опубликовать бота")
        return
      }

      const nextBot = data.bot as PublishedBot
      setItems((prev) => [nextBot, ...prev])
      setSelectedBotId(nextBot.id)
      setBotMessagesById((prev) => ({
        ...prev,
        [nextBot.id]: createInitialBotMessages(nextBot.config),
      }))
      toast.success("Бот опубликован")
    })
  }

  function removePublication(botId: number) {
    setIsDeletingId(botId)
    void fetch(`/api/bots/${botId}`, { method: "DELETE" })
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          toast.error(data?.message ?? "Не удалось снять публикацию")
          return
        }

        setItems((prev) => prev.filter((item) => item.id !== botId))
        setBotMessagesById((prev) => {
          const next = { ...prev }
          delete next[botId]
          return next
        })
        toast.success("Публикация удалена")
      })
      .catch(() => {
        toast.error("Не удалось снять публикацию")
      })
      .finally(() => {
        setIsDeletingId(null)
      })
  }

  function openBot(botId: number) {
    setSelectedBotId(botId)
    setBotDraft("")
  }

  function sendMessageToBot() {
    if (!selectedBot) {
      return
    }

    const content = botDraft.trim()
    if (!content) {
      return
    }

    const userMessage = createUserMessage(content)
    const botReply = createBotMessage(buildBotReply(selectedBot.config, content))

    setBotMessagesById((prev) => ({
      ...prev,
      [selectedBot.id]: [...(prev[selectedBot.id] ?? createInitialBotMessages(selectedBot.config)), userMessage, botReply],
    }))
    setBotDraft("")
  }

  return (
    <main className="min-h-screen bg-background pb-24">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Конструктор ботов</CardTitle>
            <CardDescription>
              {user.firstName}, здесь можно собрать сценарий, опубликовать бота и сразу протестировать его как отдельный диалог.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[1.05fr_1fr_0.95fr]">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="bot-name">
                  Имя бота
                </label>
                <Input id="bot-name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="bot-niche">
                  Ниша
                </label>
                <Input id="bot-niche" value={niche} onChange={(event) => setNiche(event.target.value)} />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Аудитория публикации</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={audience === "client" ? "default" : "outline"}
                    onClick={() => setAudience("client")}
                  >
                    Клиенты
                  </Button>
                  <Button
                    type="button"
                    variant={audience === "user" ? "default" : "outline"}
                    onClick={() => setAudience("user")}
                  >
                    Пользователи
                  </Button>
                </div>
              </div>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Библиотека блоков</CardTitle>
                  <CardDescription>
                    Добавляйте блоки для продаж, поддержки, аналитики и передачи человеку.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {blockLibrary.map((block) => (
                    <div key={block.type} className="rounded-2xl border border-border/70 bg-background/80 p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{block.title}</p>
                          <p className="text-xs text-muted-foreground">{block.badge}</p>
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => addBlock(block)}>
                          <PlusIcon className="size-4" />
                          Добавить
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">{block.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Сценарий бота</CardTitle>
                  <CardDescription>
                    Этот сценарий будет определять ответы опубликованного бота в диалоге.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {blocks.map((block) => (
                    <div key={block.id} className="rounded-2xl border border-border/70 p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{block.title}</p>
                          <p className="text-xs text-muted-foreground">{block.type}</p>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => removeBlock(block.id)}
                          disabled={blocks.length <= 1}
                          aria-label={`Удалить блок ${block.title}`}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                      <textarea
                        value={block.value}
                        onChange={(event) => updateBlock(block.id, event.target.value)}
                        className="min-h-28 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Превью конфигурации</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">{previewConfig.name}</p>
                    <p className="text-muted-foreground">{previewConfig.niche || "Без указания ниши"}</p>
                  </div>
                  <div>
                    <p className="font-medium">Блоков в сценарии</p>
                    <p className="text-muted-foreground">{previewConfig.flow.length}</p>
                  </div>
                  <div>
                    <p className="font-medium">Ключевые блоки</p>
                    <p className="text-muted-foreground">{previewConfig.skills.join(", ")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={copyConfig}>
                      Скопировать конфиг
                    </Button>
                    <Button type="button" onClick={publishBot} disabled={isPublishing}>
                      {isPublishing ? "Публикуем..." : "Опубликовать"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Опубликованные боты</CardTitle>
                  <CardDescription>Каждого бота можно открыть как отдельный диалог.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Публикаций пока нет.</p>
                  ) : (
                    items.map((bot) => (
                      <div
                        key={bot.id}
                        className={`rounded-2xl border p-3 transition ${
                          selectedBotId === bot.id ? "border-primary bg-primary/5" : "border-border/70"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-medium">{bot.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {audienceLabels[bot.audience]}
                              {bot.niche ? ` · ${bot.niche}` : ""}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isDeletingId === bot.id}
                            onClick={() => removePublication(bot.id)}
                          >
                            {isDeletingId === bot.id ? "Удаляем..." : "Удалить"}
                          </Button>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button type="button" size="sm" onClick={() => openBot(bot.id)}>
                            <MessageCircleIcon className="size-4" />
                            Открыть
                          </Button>
                          <Button type="button" size="sm" variant="secondary">
                            <BotIcon className="size-4" />
                            {bot.config.flow.length} блоков
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Диалог с ботом</CardTitle>
                  <CardDescription>
                    {selectedBot
                      ? `Тестовый чат с ботом ${selectedBot.name}.`
                      : "Опубликуйте бота или выберите его из списка."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedBot ? (
                    <>
                      <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-2xl border border-border/70 bg-muted/20 p-3">
                        {(botMessagesById[selectedBot.id] ?? createInitialBotMessages(selectedBot.config)).map(
                          (message) => (
                            <div
                              key={message.id}
                              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                                  message.role === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : "border border-border/70 bg-background"
                                }`}
                              >
                                {message.content}
                              </div>
                            </div>
                          )
                        )}
                      </div>

                      <div className="rounded-2xl border border-border/70 p-3">
                        <div className="mb-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>Роль: {audienceLabels[selectedBot.audience]}</span>
                          <span>Каналы: {selectedBot.config.channels.join(", ")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            value={botDraft}
                            onChange={(event) => setBotDraft(event.target.value)}
                            placeholder="Введите сообщение для бота"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault()
                                sendMessageToBot()
                              }
                            }}
                          />
                          <Button type="button" onClick={sendMessageToBot} disabled={!botDraft.trim()}>
                            <SendIcon className="size-4" />
                            Отправить
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      После публикации бот появится здесь и его можно будет тестировать как чат.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </section>

      <BottomNav active="bots" />
    </main>
  )
}
