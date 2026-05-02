export type BotFlowItem = {
  type: string
  title: string
  value: string
}

export type BotConfig = {
  name: string
  niche: string
  goal: string
  tone: string
  greeting: string
  knowledge: string[]
  channels: string[]
  skills: string[]
  guardrails: string[]
  escalation: string
  flow: BotFlowItem[]
  handoffEnabled: boolean
  analytics: {
    trackLeads: boolean
    trackFallbacks: boolean
    summaryWindow: string
  }
}

export type BotChatMessage = {
  id: string
  role: "bot" | "user"
  content: string
}

function normalizeText(value: string) {
  return value.toLowerCase()
}

function findFlowValue(config: BotConfig, types: string[]) {
  return (
    config.flow.find((item) => types.includes(item.type))?.value ||
    config.flow.find((item) =>
      types.some((type) => normalizeText(item.title).includes(type))
    )?.value ||
    ""
  )
}

function formatList(values: string[]) {
  return values.filter(Boolean).slice(0, 3).join(", ")
}

export function createInitialBotMessages(config: BotConfig): BotChatMessage[] {
  return [
    {
      id: "bot-greeting",
      role: "bot",
      content: config.greeting.trim() || `Здравствуйте! Я бот ${config.name}. Чем могу помочь?`,
    },
  ]
}

export function buildBotReply(config: BotConfig, userMessage: string): string {
  const message = normalizeText(userMessage)

  const guardrail = config.guardrails[0]?.trim()
  const faq = findFlowValue(config, ["faq", "integration"])
  const qualification = findFlowValue(config, ["qualification"])
  const objections = findFlowValue(config, ["objections"])
  const leadCapture = findFlowValue(config, ["lead_capture"])
  const handoff = findFlowValue(config, ["handoff"])
  const followUp = findFlowValue(config, ["follow_up"])

  if (message.includes("цена") || message.includes("стоим") || message.includes("тариф")) {
    return [faq || qualification, guardrail ? `Важно: ${guardrail}` : ""].filter(Boolean).join("\n\n")
  }

  if (
    message.includes("остав") ||
    message.includes("заяв") ||
    message.includes("связ") ||
    message.includes("контакт")
  ) {
    return [
      leadCapture || "Давайте соберём контакты и передадим запрос дальше.",
      config.handoffEnabled ? handoff || config.escalation : "",
    ]
      .filter(Boolean)
      .join("\n\n")
  }

  if (
    message.includes("дорого") ||
    message.includes("сомне") ||
    message.includes("не уверен") ||
    message.includes("почему")
  ) {
    return [objections || qualification, faq].filter(Boolean).join("\n\n")
  }

  if (message.includes("что уме") || message.includes("что можешь") || message.includes("возмож")) {
    return [
      `Я настроен на сценарий "${config.goal}".`,
      config.skills.length > 0 ? `Мои ключевые блоки: ${formatList(config.skills)}.` : "",
      config.channels.length > 0 ? `Могу работать в каналах: ${formatList(config.channels)}.` : "",
    ]
      .filter(Boolean)
      .join(" ")
  }

  if (message.includes("привет") || message.includes("здрав")) {
    return [config.greeting, qualification || followUp].filter(Boolean).join("\n\n")
  }

  if (faq) {
    return [qualification || config.goal, faq, config.handoffEnabled ? config.escalation : ""]
      .filter(Boolean)
      .join("\n\n")
  }

  return [
    qualification || config.goal || `Помогаю по сценарию ${config.name}.`,
    followUp || "Опишите задачу чуть подробнее, и я подберу следующий шаг.",
  ]
    .filter(Boolean)
    .join("\n\n")
}
