export type BotFlowItem = {
  type: string
  title: string
  value: string
}

export type BotScriptRule =
  | {
      id: string
      kind: "includes"
      patterns: string[]
      reply: string
    }
  | {
      id: string
      kind: "regex"
      pattern: string
      flags: string
      reply: string
    }

export type BotScriptProgram = {
  name: string
  niche: string
  goal: string
  tone: string
  greeting: string
  fallback: string
  guard: string
  handoff: string
  rules: BotScriptRule[]
  errors: string[]
}

export type BotConfig = {
  name: string
  username?: string
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
  script?: string
}

export type BotChatMessage = {
  id: string
  role: "bot" | "user"
  content: string
}

const BOT_TEXT_RULE_METHODS = ["rule_contains"] as const
const BOT_SINGLE_BLOCK_METHODS = [
  ["greeting", "greeting"],
  ["guard", "guard"],
  ["safety", "guard"],
  ["handoff", "handoff"],
  ["escalate", "handoff"],
  ["default", "fallback"],
  ["reply", "fallback"],
] as const

const DEFAULT_GREETING = "Здравствуйте! Я бот. Чем могу помочь?"
const DEFAULT_FALLBACK = "Опишите задачу чуть подробнее, и я подберу следующий шаг."

function normalizeText(value: string) {
  return value.toLowerCase()
}

function findFlowValue(config: BotConfig, types: string[]) {
  return (
    config.flow.find((item) => types.includes(item.type))?.value ||
    config.flow.find((item) => types.some((type) => normalizeText(item.title).includes(type)))?.value ||
    ""
  )
}

function formatList(values: string[]) {
  return values.filter(Boolean).slice(0, 3).join(", ")
}

function parseQuotedValues(source: string) {
  const values = Array.from(source.matchAll(/"([^"]+)"/g), (match) => match[1]?.trim() ?? "")
  return values.filter(Boolean)
}

function parseRegexLiteral(source: string) {
  const match = source.trim().match(/^\/(.+)\/([a-z]*)$/i)
  if (!match) {
    return null
  }

  return {
    pattern: match[1] ?? "",
    flags: match[2] ?? "",
  }
}

function parsePythonStringLiteral(source: string) {
  const trimmed = source.trim()
  const rawTripleMatch = trimmed.match(/^r?"""([\s\S]*)"""$/)
  if (rawTripleMatch) {
    return rawTripleMatch[1] ?? ""
  }

  const rawSingleMatch = trimmed.match(/^r?"([^"]*)"$/)
  if (rawSingleMatch) {
    return rawSingleMatch[1] ?? ""
  }

  return null
}

function splitPythonArguments(source: string) {
  const parts: string[] = []
  let current = ""
  let squareDepth = 0
  let parenDepth = 0
  let inTriple = false
  let inDouble = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? ""
    const nextThree = source.slice(index, index + 3)

    if (!inDouble && nextThree === '"""') {
      inTriple = !inTriple
      current += nextThree
      index += 2
      continue
    }

    if (!inTriple && char === '"' && source[index - 1] !== "\\") {
      inDouble = !inDouble
      current += char
      continue
    }

    if (!inTriple && !inDouble) {
      if (char === "[") squareDepth += 1
      if (char === "]") squareDepth -= 1
      if (char === "(") parenDepth += 1
      if (char === ")") parenDepth -= 1

      if (char === "," && squareDepth === 0 && parenDepth === 0) {
        if (current.trim()) {
          parts.push(current.trim())
        }
        current = ""
        continue
      }
    }

    current += char
  }

  if (current.trim()) {
    parts.push(current.trim())
  }

  return parts
}

function parsePythonPatternList(source: string) {
  const trimmed = source.trim()
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return []
  }

  return parseQuotedValues(trimmed.slice(1, -1))
}

function extractNamedArgument(args: string[], name: string) {
  const item = args.find((part) => part.startsWith(`${name}=`)) ?? ""
  if (!item) {
    return null
  }

  return parsePythonStringLiteral(item.replace(new RegExp(`^${name}\\s*=\\s*`), ""))
}

function compilePythonLibraryBotScript(script: string): BotScriptProgram | null {
  if (
    !/(ShalterBot|Bot)\s*\(/.test(script) &&
    !/bot\.(greeting|guard|safety|handoff|escalate|default|reply|rule_contains|rule_regex|command|on_command|on_text|on_regex|hears|matches)/.test(script)
  ) {
    return null
  }

  const errors: string[] = []
  const program: BotScriptProgram = {
    name: "",
    niche: "",
    goal: "",
    tone: "",
    greeting: "",
    fallback: "",
    guard: "",
    handoff: "",
    rules: [],
    errors,
  }

  const constructorMatch = script.match(/(?:bot\s*=\s*)?(?:ShalterBot|Bot)\s*\(([\s\S]*?)\)/)
  if (constructorMatch) {
    const constructorArgs = constructorMatch[1] ?? ""
    const metaPatterns = [
      ["name", /name\s*=\s*"([^"]+)"/],
      ["niche", /niche\s*=\s*"([^"]+)"/],
      ["goal", /goal\s*=\s*"([^"]+)"/],
      ["tone", /tone\s*=\s*"([^"]+)"/],
    ] as const

    for (const [key, pattern] of metaPatterns) {
      const match = constructorArgs.match(pattern)
      const value = match?.[1]?.trim() ?? ""
      if (key === "name") program.name = value
      if (key === "niche") program.niche = value
      if (key === "goal") program.goal = value
      if (key === "tone") program.tone = value
    }
  }

  for (const [methodName, targetKey] of BOT_SINGLE_BLOCK_METHODS) {
    const methodMatch = script.match(
      new RegExp(`bot\\.${methodName}\\(\\s*(r?"""[\\s\\S]*?"""|r?"[^"]*")\\s*\\)`, "m")
    )
    const rawValue = methodMatch?.[1]
    const parsedValue = rawValue ? parsePythonStringLiteral(rawValue) : null
    if (typeof parsedValue === "string") {
      if (targetKey === "greeting") program.greeting = parsedValue.trim()
      if (targetKey === "guard") program.guard = parsedValue.trim()
      if (targetKey === "handoff") program.handoff = parsedValue.trim()
      if (targetKey === "fallback") program.fallback = parsedValue.trim()
    }
  }

  const ruleContainsMatches = Array.from(
    script.matchAll(
      new RegExp(
        `bot\\.(?:${BOT_TEXT_RULE_METHODS.join("|")})\\(\\s*(\\[[\\s\\S]*?\\]|r?"[^"]*")\\s*,\\s*(r?"""[\\s\\S]*?"""|r?"[^"]*")\\s*\\)`,
        "g"
      )
    )
  )

  for (const match of ruleContainsMatches) {
    const patternsArg = match[1] ?? ""
    const patterns =
      parsePythonPatternList(patternsArg).length > 0
        ? parsePythonPatternList(patternsArg)
        : parseQuotedValues(patternsArg)
    const reply = parsePythonStringLiteral(match[2] ?? "") ?? ""
    if (patterns.length === 0) {
      errors.push("У правила bot.rule_contains() должен быть список шаблонов.")
    }

    program.rules.push({
      id: `rule-${program.rules.length + 1}`,
      kind: "includes",
      patterns,
      reply: reply.trim(),
    })
  }

  const ruleRegexMatches = Array.from(
    script.matchAll(/bot\.rule_regex\(([\s\S]*?)\)/g)
  )

  for (const match of ruleRegexMatches) {
    const args = splitPythonArguments(match[1] ?? "")
    const patternArg = args[0] ?? ""
    const replyArg = args[1] ?? ""
    const flagsArg = args.find((item) => item.startsWith("flags=")) ?? ""
    const rawPattern = parsePythonStringLiteral(patternArg)
    const reply = parsePythonStringLiteral(replyArg) ?? ""
    const flags = parsePythonStringLiteral(flagsArg.replace(/^flags\s*=\s*/, "")) ?? ""

    if (!rawPattern) {
      errors.push("У правила bot.rule_regex() нет шаблона.")
    }

    program.rules.push({
      id: `rule-${program.rules.length + 1}`,
      kind: "regex",
      pattern: (rawPattern ?? "").replace(/^\/|\/[a-z]*$/gi, ""),
      flags,
      reply: reply.trim(),
    })
  }

  const commandMatches = Array.from(script.matchAll(/bot\.(command|on_command)\(([\s\S]*?)\)/g))

  for (const match of commandMatches) {
    const args = splitPythonArguments(match[2] ?? "")
    const commandArg = args[0] ?? ""
    const replyArg = args[1] ?? ""
    const command = parsePythonStringLiteral(commandArg)?.trim().replace(/^\/+/, "") ?? ""
    const reply = parsePythonStringLiteral(replyArg) ?? ""

    if (!command) {
      errors.push("У правила bot.command() нет имени команды.")
    }

    program.rules.push({
      id: `rule-${program.rules.length + 1}`,
      kind: "regex",
      pattern: `^/?${command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      flags: "i",
      reply: reply.trim(),
    })
  }

  const textAliasMatches = Array.from(script.matchAll(/bot\.on_text\(([\s\S]*?)\)/g))

  for (const match of textAliasMatches) {
    const args = splitPythonArguments(match[1] ?? "")
    const patternsArg = args[0] ?? ""
    const replyArg = args[1] ?? ""
    const patterns =
      parsePythonPatternList(patternsArg).length > 0
        ? parsePythonPatternList(patternsArg)
        : parseQuotedValues(patternsArg)
    const reply = parsePythonStringLiteral(replyArg) ?? ""

    if (patterns.length === 0) {
      errors.push("У правила bot.on_text() должен быть список или строка шаблонов.")
    }

    program.rules.push({
      id: `rule-${program.rules.length + 1}`,
      kind: "includes",
      patterns,
      reply: reply.trim(),
    })
  }

  const hearsMatches = Array.from(script.matchAll(/bot\.hears\(([\s\S]*?)\)/g))

  for (const match of hearsMatches) {
    const args = splitPythonArguments(match[1] ?? "")
    const patternsArg = args[0] ?? ""
    const replyArg = args[1] ?? ""
    const patterns =
      parsePythonPatternList(patternsArg).length > 0
        ? parsePythonPatternList(patternsArg)
        : parseQuotedValues(patternsArg)
    const reply = parsePythonStringLiteral(replyArg) ?? ""

    if (patterns.length === 0) {
      errors.push("У правила bot.hears() должен быть список или строка шаблонов.")
    }

    program.rules.push({
      id: `rule-${program.rules.length + 1}`,
      kind: "includes",
      patterns,
      reply: reply.trim(),
    })
  }

  const regexAliasMatches = Array.from(script.matchAll(/bot\.on_regex\(([\s\S]*?)\)/g))

  for (const match of regexAliasMatches) {
    const args = splitPythonArguments(match[1] ?? "")
    const rawPattern = parsePythonStringLiteral(args[0] ?? "")
    const reply = parsePythonStringLiteral(args[1] ?? "") ?? ""
    const flags = extractNamedArgument(args, "flags") ?? ""

    if (!rawPattern) {
      errors.push("У правила bot.on_regex() нет шаблона.")
    }

    program.rules.push({
      id: `rule-${program.rules.length + 1}`,
      kind: "regex",
      pattern: (rawPattern ?? "").replace(/^\/|\/[a-z]*$/gi, ""),
      flags,
      reply: reply.trim(),
    })
  }

  const matchesAliasMatches = Array.from(script.matchAll(/bot\.matches\(([\s\S]*?)\)/g))

  for (const match of matchesAliasMatches) {
    const args = splitPythonArguments(match[1] ?? "")
    const rawPattern = parsePythonStringLiteral(args[0] ?? "")
    const reply = parsePythonStringLiteral(args[1] ?? "") ?? ""
    const flags = extractNamedArgument(args, "flags") ?? ""

    if (!rawPattern) {
      errors.push("У правила bot.matches() нет шаблона.")
    }

    program.rules.push({
      id: `rule-${program.rules.length + 1}`,
      kind: "regex",
      pattern: (rawPattern ?? "").replace(/^\/|\/[a-z]*$/gi, ""),
      flags,
      reply: reply.trim(),
    })
  }

  if (!program.greeting) {
    errors.push('Добавьте bot.greeting("""...""")')
  }

  if (!program.fallback) {
    errors.push('Добавьте bot.default("""...""")')
  }

  if (program.rules.length === 0) {
    errors.push("Добавьте хотя бы одно правило bot.rule_contains(...) или bot.rule_regex(...)")
  }

  for (const rule of program.rules) {
    if (!rule.reply.trim()) {
      errors.push(`Пустой ответ у правила ${rule.id}.`)
    }

    if (rule.kind === "regex" && rule.pattern) {
      try {
        new RegExp(rule.pattern, rule.flags)
      } catch {
        errors.push(`Некорректное регулярное выражение в ${rule.id}.`)
      }
    }
  }

  return program
}

export function compileBotScript(script: string): BotScriptProgram {
  const pythonProgram = compilePythonLibraryBotScript(script)
  if (pythonProgram) {
    return pythonProgram
  }

  const lines = script.replace(/\r\n/g, "\n").split("\n")
  const errors: string[] = []
  const program: BotScriptProgram = {
    name: "",
    niche: "",
    goal: "",
    tone: "",
    greeting: "",
    fallback: "",
    guard: "",
    handoff: "",
    rules: [],
    errors,
  }

  function readBlock(startIndex: number) {
    const content: string[] = []

    for (let index = startIndex; index < lines.length; index += 1) {
      if (lines[index].trim() === '"""') {
        return {
          value: content.join("\n").trim(),
          nextIndex: index + 1,
        }
      }

      content.push(lines[index])
    }

    errors.push(`Не закрыт блок """ возле строки ${startIndex}.`)
    return {
      value: content.join("\n").trim(),
      nextIndex: lines.length,
    }
  }

  let index = 0
  while (index < lines.length) {
    const rawLine = lines[index] ?? ""
    const line = rawLine.trim()

    if (!line || line.startsWith("#")) {
      index += 1
      continue
    }

    const metaMatch = line.match(/^(name|niche|goal|tone)\s+"([^"]+)"$/)
    if (metaMatch) {
      const [, key, value] = metaMatch
      if (key === "name") program.name = value.trim()
      if (key === "niche") program.niche = value.trim()
      if (key === "goal") program.goal = value.trim()
      if (key === "tone") program.tone = value.trim()
      index += 1
      continue
    }

    const blockStartMatch = line.match(/^(greeting|default|guard|handoff)\s+"""$/)
    if (blockStartMatch) {
      const block = readBlock(index + 1)
      const type = blockStartMatch[1]
      if (type === "greeting") program.greeting = block.value
      if (type === "default") program.fallback = block.value
      if (type === "guard") program.guard = block.value
      if (type === "handoff") program.handoff = block.value
      index = block.nextIndex
      continue
    }

    const includesStartMatch = rawLine.match(/^\s*rule\s+includes\s+(.+)\s+"""$/)
    if (includesStartMatch) {
      const patterns = parseQuotedValues(includesStartMatch[1] ?? "")
      if (patterns.length === 0) {
        errors.push(`У правила includes возле строки ${index + 1} нет ни одного шаблона.`)
      }

      const block = readBlock(index + 1)
      program.rules.push({
        id: `rule-${program.rules.length + 1}`,
        kind: "includes",
        patterns,
        reply: block.value,
      })
      index = block.nextIndex
      continue
    }

    const regexStartMatch = rawLine.match(/^\s*rule\s+regex\s+"([^"]+)"\s+"""$/)
    if (regexStartMatch) {
      const parsedRegex = parseRegexLiteral(regexStartMatch[1] ?? "")
      if (!parsedRegex) {
        errors.push(`У правила regex возле строки ${index + 1} неверный формат. Используйте "/шаблон/i".`)
      }

      const block = readBlock(index + 1)
      program.rules.push({
        id: `rule-${program.rules.length + 1}`,
        kind: "regex",
        pattern: parsedRegex?.pattern ?? "",
        flags: parsedRegex?.flags ?? "",
        reply: block.value,
      })
      index = block.nextIndex
      continue
    }

    errors.push(`Не удалось разобрать строку ${index + 1}: ${line}`)
    index += 1
  }

  if (!program.greeting) {
    errors.push('Добавьте блок greeting """ ... """')
  }

  if (!program.fallback) {
    errors.push('Добавьте блок default """ ... """')
  }

  if (program.rules.length === 0) {
    errors.push('Добавьте хотя бы одно правило rule includes ... """ или rule regex ... """')
  }

  for (const rule of program.rules) {
    if (!rule.reply.trim()) {
      errors.push(`Пустой ответ у правила ${rule.id}.`)
    }

    if (rule.kind === "regex" && rule.pattern) {
      try {
        // Validate syntax once during compilation.
        new RegExp(rule.pattern, rule.flags)
      } catch {
        errors.push(`Некорректное регулярное выражение в ${rule.id}.`)
      }
    }
  }

  return program
}

function buildReplyFromScript(config: BotConfig, userMessage: string) {
  const program = compileBotScript(config.script ?? "")
  if (program.errors.length > 0) {
    return null
  }

  const message = normalizeText(userMessage)

  for (const rule of program.rules) {
    if (rule.kind === "includes") {
      if (rule.patterns.some((pattern) => message.includes(normalizeText(pattern)))) {
        return [rule.reply, program.guard ? `Важно: ${program.guard}` : ""].filter(Boolean).join("\n\n")
      }
      continue
    }

    try {
      const expression = new RegExp(rule.pattern, rule.flags)
      if (expression.test(userMessage)) {
        return [rule.reply, program.guard ? `Важно: ${program.guard}` : ""].filter(Boolean).join("\n\n")
      }
    } catch {
      continue
    }
  }

  return [program.fallback || DEFAULT_FALLBACK, program.guard ? `Важно: ${program.guard}` : ""]
    .filter(Boolean)
    .join("\n\n")
}

export function createBotConfigFromScript(script: string, username = ""): BotConfig {
  const program = compileBotScript(script)
  const flow =
    program.rules.length > 0
      ? program.rules.map((rule, index) => ({
          type: rule.kind === "regex" ? "regex" : "includes",
          title:
            rule.kind === "regex"
              ? `Regex rule ${index + 1}`
              : `Includes: ${rule.patterns.slice(0, 2).join(", ") || `rule ${index + 1}`}`,
          value: rule.reply,
        }))
      : [
          {
            type: "default",
            title: "Default",
            value: program.fallback || DEFAULT_FALLBACK,
          },
        ]

  return {
    name: program.name || "Новый бот",
    username,
    niche: program.niche,
    goal: program.goal || "Отвечать на сообщения по правилам сценария.",
    tone: program.tone || "Спокойный, точный, дружелюбный.",
    greeting: program.greeting || DEFAULT_GREETING,
    knowledge: [],
    channels: ["Built-in chat"],
    skills: program.rules.map((rule, index) =>
      rule.kind === "regex" ? `Regex rule ${index + 1}` : rule.patterns.join(", ")
    ),
    guardrails: program.guard ? [program.guard] : [],
    escalation: program.handoff,
    flow,
    handoffEnabled: Boolean(program.handoff),
    analytics: {
      trackLeads: true,
      trackFallbacks: true,
      summaryWindow: "7d",
    },
    script,
  }
}

export function createInitialBotMessages(config: BotConfig): BotChatMessage[] {
  const scriptProgram = config.script ? compileBotScript(config.script) : null
  const greeting =
    scriptProgram && scriptProgram.errors.length === 0
      ? scriptProgram.greeting || config.greeting.trim()
      : config.greeting.trim()

  return [
    {
      id: "bot-greeting",
      role: "bot",
      content: greeting || `Здравствуйте! Я бот ${config.name}. Чем могу помочь?`,
    },
  ]
}

export function buildBotReply(config: BotConfig, userMessage: string): string {
  const scriptedReply = config.script ? buildReplyFromScript(config, userMessage) : null
  if (scriptedReply) {
    return scriptedReply
  }

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

  return [qualification || config.goal || `Помогаю по сценарию ${config.name}.`, followUp || DEFAULT_FALLBACK]
    .filter(Boolean)
    .join("\n\n")
}
