"use client"

import { BotIcon, CopyIcon, MessageCircleIcon, SendIcon } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  type BotChatMessage,
  type BotConfig,
  buildBotReply,
  compileBotScript,
  createBotConfigFromScript,
  createInitialBotMessages,
} from "@/features/bots/lib/runtime"
import { BotCodeEditor } from "@/features/bots/ui/bot-code-editor"
import { BottomNav } from "@/features/navigation/ui/bottom-nav"
import { hasAdministrativeAccess } from "@/shared/lib/auth/roles"

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
  username?: string
  niche: string | null
  audience: "client" | "user"
  publishedAt: string
  config: BotConfig
  ownerId?: number
  ownerName?: string
  isMine?: boolean
}

export type BotsHomeProps = {
  user: BotUser
  publishedBots?: PublishedBot[]
  initialSelectedBotId?: number | null
}

const audienceLabels: Record<PublishedBot["audience"], string> = {
  client: "Клиенты",
  user: "Пользователи",
}

const starterScript = `from shalter import ShalterBot

bot = ShalterBot(
    name="Новый бот",
    niche="Поддержка и продажи",
    goal="Быстро понимать запрос и вести пользователя к следующему шагу.",
    tone="Спокойный, точный, дружелюбный.",
)

bot.greeting("""
Привет! Я бот внутри Shalter. Напиши, что тебе нужно, и я помогу.
""")

bot.guard("""
Не придумывай цены, сроки и юридические обещания без подтверждения.
""")

bot.hears(["привет", "здравствуйте", "hello"], """
Привет! Я на связи. Могу подсказать по продукту, заявке или следующему действию.
""")

bot.rule_contains(["цена", "стоимость", "тариф"], """
Стоимость зависит от задачи. Напиши, что именно нужно, и я сориентирую по формату.
""")

bot.rule_contains(["заявка", "менеджер", "контакт"], """
Оставь контакт и коротко опиши задачу. Если нужно, я передам диалог человеку.
""")

bot.matches(r"(ошибка|не работает|bug)", """
Похоже на проблему или баг. Опиши, что именно сломалось, и добавь шаги воспроизведения.
""", flags="i")

bot.handoff("""
Если вопрос нестандартный, связан с оплатой или конфликтной ситуацией, передай диалог человеку.
""")

bot.default("""
Опиши задачу чуть подробнее, и я подберу для тебя следующий шаг.
""")`

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

function getRuleCount(config: BotConfig) {
  if (config.script) {
    return compileBotScript(config.script).rules.length
  }

  return config.flow.length
}

export function BotsHome({
  user,
  publishedBots = [],
  initialSelectedBotId = null,
}: BotsHomeProps) {
  const [username, setUsername] = useState("")
  const [audience, setAudience] = useState<PublishedBot["audience"]>("client")
  const [script, setScript] = useState(starterScript)
  const [items, setItems] = useState<PublishedBot[]>(publishedBots)
  const [selectedBotId, setSelectedBotId] = useState<number | null>(
    initialSelectedBotId && publishedBots.some((bot) => bot.id === initialSelectedBotId)
      ? initialSelectedBotId
      : publishedBots[0]?.id ?? null
  )
  const [botDraft, setBotDraft] = useState("")
  const [botMessagesById, setBotMessagesById] = useState<Record<number, BotChatMessage[]>>({})
  const [isPublishing, startPublishing] = useTransition()
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null)

  const normalizedUsername = username.trim().toLowerCase()
  const scriptProgram = useMemo(() => compileBotScript(script), [script])
  const previewConfig = useMemo(
    () => createBotConfigFromScript(script, normalizedUsername),
    [normalizedUsername, script]
  )

  const selectedBot = items.find((item) => item.id === selectedBotId) ?? items[0] ?? null

  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(previewConfig, null, 2))
      toast.success("Конфиг бота скопирован")
    } catch {
      toast.error("Не удалось скопировать конфиг")
    }
  }

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(script)
      toast.success("Код бота скопирован")
    } catch {
      toast.error("Не удалось скопировать код")
    }
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
          toast.error(data?.message ?? "Не удалось удалить бота")
          return
        }

        setItems((prev) => prev.filter((item) => item.id !== botId))
        setBotMessagesById((prev) => {
          const next = { ...prev }
          delete next[botId]
          return next
        })
        toast.success("Бот удалён")
      })
      .catch(() => {
        toast.error("Не удалось удалить бота")
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
      [selectedBot.id]: [
        ...(prev[selectedBot.id] ?? createInitialBotMessages(selectedBot.config)),
        userMessage,
        botReply,
      ],
    }))
    setBotDraft("")
  }

  return (
    <main className="min-h-screen bg-background pb-24">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Язык ботов</CardTitle>
            <CardDescription>
              {user.firstName}, теперь бот создаётся кодом во встроенном редакторе. Основной формат
              теперь похож на Python-библиотеку `ShalterBot(...)`, а старый DSL тоже остаётся рабочим.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[0.92fr_1.18fr_0.9fr]">
            <div className="space-y-4">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Публикация</CardTitle>
                  <CardDescription>
                    Username и аудитория задаются отдельно, остальное бот берёт из кода.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="bot-username">
                      Username
                    </label>
                    <Input
                      id="bot-username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="my_bot"
                      autoComplete="off"
                    />
                    <p className="text-xs text-muted-foreground">@username, 4-32 символа: a-z, 0-9 и _</p>
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

                  <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm">
                    <p className="font-medium">Что умеет язык</p>
                    <p className="text-muted-foreground">
                      <code>bot = ShalterBot(...)</code>, методы <code>bot.greeting()</code>,{" "}
                      <code>bot.guard()</code>, <code>bot.handoff()</code>, <code>bot.default()</code>,{" "}
                      <code>bot.hears()</code> и <code>bot.matches()</code>.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={copyScript}>
                      <CopyIcon className="size-4" />
                      Скопировать код
                    </Button>
                    <Button type="button" variant="outline" onClick={copyConfig}>
                      <CopyIcon className="size-4" />
                      Скопировать конфиг
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Превью программы</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">{previewConfig.name}</p>
                    {normalizedUsername ? <p className="text-muted-foreground">@{normalizedUsername}</p> : null}
                    <p className="text-muted-foreground">{previewConfig.niche || "Без указанной ниши"}</p>
                  </div>
                  <div>
                    <p className="font-medium">Правил</p>
                    <p className="text-muted-foreground">{scriptProgram.rules.length}</p>
                  </div>
                  <div>
                    <p className="font-medium">Цель</p>
                    <p className="text-muted-foreground">{previewConfig.goal}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={publishBot}
                      disabled={
                        isPublishing ||
                        normalizedUsername.length < 4 ||
                        scriptProgram.errors.length > 0 ||
                        previewConfig.name.trim().length < 2
                      }
                    >
                      {isPublishing ? "Публикуем..." : "Опубликовать"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Встроенный редактор</CardTitle>
                  <CardDescription>
                    Пишите код сценария прямо здесь. Бот можно описывать как питоноподобную библиотеку.
                    Полная документация: <code>docs/BOT_LANGUAGE.md</code>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <BotCodeEditor value={script} onChange={setScript} />
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm">
                    <p className="font-medium">Шпаргалка</p>
                    <div className="mt-2 space-y-1 text-muted-foreground">
                      <p>
                        <code>bot = ShalterBot(name=&quot;Имя бота&quot;, ...)</code>
                      </p>
                      <p>
                        <code>bot.greeting(&quot;&quot;&quot; ... &quot;&quot;&quot;)</code>
                      </p>
                      <p>
                        <code>bot.hears([&quot;цена&quot;, &quot;тариф&quot;], &quot;&quot;&quot; ... &quot;&quot;&quot;)</code>
                      </p>
                      <p>
                        <code>bot.matches(r&quot;(bug|ошибка)&quot;, &quot;&quot;&quot; ... &quot;&quot;&quot;, flags=&quot;i&quot;)</code>
                      </p>
                      <p>
                        <code>bot.default(&quot;&quot;&quot; ... &quot;&quot;&quot;)</code>
                      </p>
                    </div>
                  </div>
                  {scriptProgram.errors.length > 0 ? (
                    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                      {scriptProgram.errors.map((error, index) => (
                        <p key={`${error}-${index}`}>{error}</p>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                      Код разобран успешно. Бот готов к публикации.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Опубликованные боты</CardTitle>
                  <CardDescription>Каждый бот открывается как отдельный диалог и использует свой код.</CardDescription>
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
                            {bot.username ? <p className="truncate text-xs text-muted-foreground">@{bot.username}</p> : null}
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
                            {getRuleCount(bot.config)} правил
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
                          <span>Правил: {getRuleCount(selectedBot.config)}</span>
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
                      После публикации бот появится здесь, и его можно будет тестировать как обычный чат.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </section>

      <BottomNav active="bots" showServerTab={hasAdministrativeAccess(user.role)} />
    </main>
  )
}
