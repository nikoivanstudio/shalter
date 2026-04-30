"use client"

import {
  BotIcon,
  BrainCircuitIcon,
  CopyIcon,
  MessageSquareQuoteIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react"
import { useId, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import { toast } from "sonner"

import { AccountStatusBadge } from "@/components/ui/account-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

const STARTER_CHANNELS = ["Сайт", "Telegram", "WhatsApp", "Instagram"]
const STARTER_SKILLS = [
  "Отвечать на частые вопросы",
  "Собирать заявки",
  "Фильтровать лиды",
  "Передавать диалог менеджеру",
]
const STARTER_GUARDRAILS = [
  "Не придумывает цены и сроки",
  "Не обещает скидки без подтверждения",
  "Просит контакты только после согласия клиента",
]

export function BotsHome({ user }: { user: UserShort }) {
  const { tr } = useI18n()
  const botNameId = useId()
  const nicheId = useId()
  const goalId = useId()
  const toneId = useId()
  const greetingId = useId()
  const knowledgeId = useId()
  const escalationId = useId()
  const [botName, setBotName] = useState("Shalter Assist")
  const [niche, setNiche] = useState("Онлайн-сервис и продажи")
  const [goal, setGoal] = useState("Отвечать за 30 секунд, собирать заявки и доводить до целевого действия.")
  const [tone, setTone] = useState("Дружелюбный, уверенный, без канцелярита.")
  const [greeting, setGreeting] = useState(
    "Привет! Я помогу быстро подобрать решение, ответить на вопросы и передать вас человеку, если потребуется."
  )
  const [knowledge, setKnowledge] = useState(
    "Тарифы, преимущества продукта, сценарии подключения, FAQ, ограничения, акции, ссылки на оплату."
  )
  const [escalation, setEscalation] = useState(
    "Если клиент просит нестандартную скидку, договор, возврат или живого менеджера, бот сразу передаёт диалог человеку."
  )
  const [channels, setChannels] = useState(STARTER_CHANNELS)
  const [skills, setSkills] = useState(STARTER_SKILLS)
  const [guardrails, setGuardrails] = useState(STARTER_GUARDRAILS)

  const emblem = buildEmblem(user.firstName, user.lastName)
  const emblemTone = getEmblemTone(user.firstName, user.lastName, user.avatarTone)
  const botConfig = useMemo(
    () => ({
      name: botName.trim(),
      niche: niche.trim(),
      goal: goal.trim(),
      tone: tone.trim(),
      greeting: greeting.trim(),
      knowledge: knowledge
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      channels: channels.map((item) => item.trim()).filter(Boolean),
      skills: skills.map((item) => item.trim()).filter(Boolean),
      guardrails: guardrails.map((item) => item.trim()).filter(Boolean),
      escalation: escalation.trim(),
      handoffEnabled: true,
      analytics: {
        trackLeads: true,
        trackFallbacks: true,
        summaryWindow: "daily",
      },
    }),
    [botName, niche, goal, tone, greeting, knowledge, channels, skills, guardrails, escalation]
  )
  const configPreview = JSON.stringify(botConfig, null, 2)

  function updateList(setter: Dispatch<SetStateAction<string[]>>, index: number, value: string) {
    setter((prev) => prev.map((item, itemIndex) => (itemIndex === index ? value : item)))
  }

  function addListItem(setter: Dispatch<SetStateAction<string[]>>, fallback: string) {
    setter((prev) => [...prev, fallback])
  }

  function removeListItem(setter: Dispatch<SetStateAction<string[]>>, index: number) {
    setter((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }

  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(configPreview)
      toast.success(tr("Конфиг бота скопирован"))
    } catch {
      toast.error(tr("Не удалось скопировать конфиг"))
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 pb-28 sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="rounded-[2rem] border border-white/50 bg-card/88 px-5 py-4 shadow-[0_20px_55px_-32px_rgba(15,23,42,0.48)] backdrop-blur-xl dark:border-white/8">
          <div className="flex items-center justify-between gap-3">
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
                  {tr("Соберите бота из блоков, проверьте стиль и сразу получите готовый конфиг.")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
        </header>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_400px]">
          <Card className="border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
            <CardHeader className="border-b border-border/55 pb-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl font-semibold tracking-tight">
                    {tr("Конструктор ботов")}
                  </CardTitle>
                  <CardDescription>
                    {tr("Настройте роль, поведение и публикацию. Это MVP без сохранения в базу, но уже с живым предпросмотром.")}
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={copyConfig}>
                  <CopyIcon className="size-4" />
                  {tr("Скопировать конфиг")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs defaultValue="identity" className="gap-5">
                <TabsList className="h-auto w-full flex-wrap justify-start rounded-[1.4rem] bg-background/70 p-1">
                  <TabsTrigger value="identity">{tr("Основа")}</TabsTrigger>
                  <TabsTrigger value="behavior">{tr("Поведение")}</TabsTrigger>
                  <TabsTrigger value="skills">{tr("Навыки")}</TabsTrigger>
                  <TabsTrigger value="publish">{tr("Публикация")}</TabsTrigger>
                </TabsList>

                <TabsContent value="identity" className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <FieldShell label={tr("Имя бота")} htmlFor={botNameId}>
                      <Input
                        id={botNameId}
                        value={botName}
                        onChange={(event) => setBotName(event.target.value)}
                      />
                    </FieldShell>
                    <FieldShell label={tr("Ниша")} htmlFor={nicheId}>
                      <Input id={nicheId} value={niche} onChange={(event) => setNiche(event.target.value)} />
                    </FieldShell>
                  </div>

                  <FieldShell label={tr("Главная цель")} htmlFor={goalId}>
                    <textarea
                      id={goalId}
                      className="min-h-28 w-full rounded-[1.2rem] border border-input bg-background/82 px-4 py-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      value={goal}
                      onChange={(event) => setGoal(event.target.value)}
                    />
                  </FieldShell>

                  <FieldShell label={tr("Приветствие")} htmlFor={greetingId}>
                    <textarea
                      id={greetingId}
                      className="min-h-32 w-full rounded-[1.2rem] border border-input bg-background/82 px-4 py-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      value={greeting}
                      onChange={(event) => setGreeting(event.target.value)}
                    />
                  </FieldShell>
                </TabsContent>

                <TabsContent value="behavior" className="space-y-5">
                  <FieldShell label={tr("Тон общения")} htmlFor={toneId}>
                    <Input id={toneId} value={tone} onChange={(event) => setTone(event.target.value)} />
                  </FieldShell>
                  <FieldShell label={tr("База знаний")} htmlFor={knowledgeId}>
                    <textarea
                      id={knowledgeId}
                      className="min-h-28 w-full rounded-[1.2rem] border border-input bg-background/82 px-4 py-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      value={knowledge}
                      onChange={(event) => setKnowledge(event.target.value)}
                    />
                  </FieldShell>
                  <FieldShell label={tr("Когда передавать человеку")} htmlFor={escalationId}>
                    <textarea
                      id={escalationId}
                      className="min-h-28 w-full rounded-[1.2rem] border border-input bg-background/82 px-4 py-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      value={escalation}
                      onChange={(event) => setEscalation(event.target.value)}
                    />
                  </FieldShell>
                </TabsContent>

                <TabsContent value="skills" className="space-y-5">
                  <ListEditor
                    icon={<SparklesIcon className="size-4" />}
                    title={tr("Сценарии и навыки")}
                    description={tr("Что бот должен делать уверенно и без участия оператора.")}
                    items={skills}
                    onChange={(index, value) => updateList(setSkills, index, value)}
                    onAdd={() => addListItem(setSkills, "Новый сценарий")}
                    onRemove={(index) => removeListItem(setSkills, index)}
                  />
                  <ListEditor
                    icon={<BrainCircuitIcon className="size-4" />}
                    title={tr("Ограничения")}
                    description={tr("Правила, которые удерживают бота в безопасных рамках.")}
                    items={guardrails}
                    onChange={(index, value) => updateList(setGuardrails, index, value)}
                    onAdd={() => addListItem(setGuardrails, "Новое ограничение")}
                    onRemove={(index) => removeListItem(setGuardrails, index)}
                  />
                </TabsContent>

                <TabsContent value="publish" className="space-y-5">
                  <ListEditor
                    icon={<WandSparklesIcon className="size-4" />}
                    title={tr("Каналы публикации")}
                    description={tr("Где бот будет доступен пользователю в первую очередь.")}
                    items={channels}
                    onChange={(index, value) => updateList(setChannels, index, value)}
                    onAdd={() => addListItem(setChannels, "Новый канал")}
                    onRemove={(index) => removeListItem(setChannels, index)}
                  />
                  <div className="rounded-[1.5rem] border border-dashed border-primary/35 bg-primary/6 p-4">
                    <p className="text-sm font-medium">{tr("Что можно сделать дальше")}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {tr("Следующим шагом сюда можно подключить сохранение шаблонов, публикацию в БД и генерацию webhook-конфига для реального канала.")}
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="overflow-hidden border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
              <CardHeader className="border-b border-border/55 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BotIcon className="size-5" />
                  {tr("Предпросмотр бота")}
                </CardTitle>
                <CardDescription>{tr("Так бот выглядит как продуктовая сущность прямо сейчас.")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="rounded-[1.6rem] border border-primary/20 bg-linear-to-br from-primary/12 via-background to-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{botConfig.name || tr("Без названия")}</p>
                      <p className="text-sm text-muted-foreground">{botConfig.niche || tr("Ниша не указана")}</p>
                    </div>
                    <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {tr("Готов к запуску")}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6">{botConfig.goal || tr("Цель пока не задана")}</p>
                </div>

                <div className="rounded-[1.5rem] border border-border/70 bg-background/78 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquareQuoteIcon className="size-4" />
                    {tr("Первое сообщение")}
                  </p>
                  <p className="mt-3 rounded-[1.25rem] bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm">
                    {botConfig.greeting || tr("Приветствие пока пустое")}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoStack title={tr("Каналы")} items={botConfig.channels} />
                  <InfoStack title={tr("Навыки")} items={botConfig.skills} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/88 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.48)]">
              <CardHeader className="border-b border-border/55 pb-4">
                <CardTitle className="text-lg">{tr("JSON-конфиг")}</CardTitle>
                <CardDescription>{tr("Можно сразу передать в API, шаблон или внешний интегратор.")}</CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <pre className="max-h-[28rem] overflow-auto rounded-[1.4rem] border border-border/70 bg-slate-950 p-4 text-xs leading-6 text-slate-100">
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

function ListEditor({
  icon,
  title,
  description,
  items,
  onChange,
  onAdd,
  onRemove,
}: {
  icon: ReactNode
  title: string
  description: string
  items: string[]
  onChange: (index: number, value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            {icon}
            {title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          Добавить
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="flex items-center gap-2">
            <Input value={item} onChange={(event) => onChange(index, event.target.value)} />
            <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(index)}>
              Убрать
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

function InfoStack({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[1.3rem] border border-border/70 bg-background/78 p-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
