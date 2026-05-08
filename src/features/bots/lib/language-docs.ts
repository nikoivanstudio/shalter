export type LanguageDocEntry = {
  label: string
  signature?: string
  description: string
}

export type LanguageDocSection = {
  id: string
  title: string
  summary: string
  bullets: string[]
  entries?: LanguageDocEntry[]
  code?: string
}

export const LANGUAGE_NAME = "Shalter Bot Script"

export const LANGUAGE_DOCS: LanguageDocSection[] = [
  {
    id: "spec",
    title: "1. Основа",
    summary:
      "Shalter Bot Script — это Python-подобный язык сценариев для ботов. Он не притворяется отдельным общим языком программирования: это компактный DSL для правил, приветствия, fallback-ответов и эскалации.",
    bullets: [
      "Синтаксис специально похож на Python: `from ... import ...`, вызовы методов, именованные аргументы, строки `\"...\"` и блоки `\"\"\"...\"\"\"`.",
      "Точка входа всегда одна: `bot = ShalterBot(...)`.",
      "Редактор и рантайм понимают комментарии `# ...`, обычные строки и raw-строки вида `r\"...\"`.",
      "Каждый сценарий состоит из метаданных бота, системных блоков и набора правил обработки сообщений.",
    ],
    entries: [
      {
        label: "import",
        signature: "from shalter import ShalterBot",
        description: "Подключает основной класс конструктора сценария.",
      },
      {
        label: "constructor",
        signature: 'bot = ShalterBot(name=\"Support\", niche=\"Sales\", goal=\"Help\", tone=\"Calm\")',
        description: "Создаёт бота и задаёт его имя, нишу, цель и тон общения.",
      },
      {
        label: "comment",
        signature: "# pricing rules",
        description: "Комментарии игнорируются парсером и нужны только для чтения сценария.",
      },
    ],
    code: `from shalter import ShalterBot

bot = ShalterBot(
    name="Support Bot",
    niche="Product support",
    goal="Help users quickly and clearly.",
    tone="Calm and precise.",
)`,
  },
  {
    id: "blocks",
    title: "2. Системные блоки",
    summary:
      "Системные блоки задают базовое поведение бота: приветствие, ограничения, эскалацию и fallback-ответ, если ни одно правило не подошло.",
    bullets: [
      "`bot.greeting(...)` задаёт первое сообщение.",
      "`bot.guard(...)` или `bot.safety(...)` добавляет ограничения и важные правила поведения.",
      "`bot.handoff(...)` или `bot.escalate(...)` описывает, когда надо передать диалог человеку.",
      "`bot.default(...)` или `bot.reply(...)` задаёт ответ по умолчанию.",
    ],
    entries: [
      {
        label: "bot.greeting",
        signature: 'bot.greeting("""Hello! How can I help?""")',
        description: "Приветствие, которое пользователь видит при открытии бота.",
      },
      {
        label: "bot.guard",
        signature: 'bot.guard("""Do not invent prices or deadlines.""")',
        description: "Ограничения и safety-правила, которые добавляются ко всем ответам.",
      },
      {
        label: "bot.default",
        signature: 'bot.default("""Tell me a bit more and I will help.""")',
        description: "Ответ, который используется, если ни одно правило не сработало.",
      },
    ],
    code: `bot.greeting("""
Hello! Describe the task and I will help.
""")

bot.guard("""
Do not invent prices, deadlines, or legal guarantees.
""")

bot.handoff("""
Escalate payment disputes and нестандартные кейсы человеку.
""")

bot.default("""
Tell me a bit more and I will suggest the next step.
""")`,
  },
  {
    id: "rules",
    title: "3. Правила",
    summary:
      "Правила отвечают за маршрутизацию сообщений. В рантайме есть три базовые категории: поиск по ключевым словам, регулярные выражения и slash-команды.",
    bullets: [
      "`bot.rule_contains(...)`, `bot.on_text(...)` и `bot.hears(...)` — это один и тот же тип правила по ключевым словам.",
      "`bot.rule_regex(...)`, `bot.on_regex(...)` и `bot.matches(...)` — правила по регулярным выражениям.",
      "`bot.command(...)` и `bot.on_command(...)` — правила для команд `/start`, `/help` и так далее.",
      "Ответ правила хранится прямо во втором аргументе и обычно оформляется через `\"\"\"...\"\"\"`.",
    ],
    entries: [
      {
        label: "bot.hears",
        signature: 'bot.hears(["price", "cost"], """Pricing depends on the task.""")',
        description: "Срабатывает, если сообщение содержит одно из ключевых слов.",
      },
      {
        label: "bot.matches",
        signature: 'bot.matches(r"(payment|billing)", """I can help with billing.""", flags="i")',
        description: "Срабатывает по регулярному выражению. `flags=\"i\"` включает ignore-case.",
      },
      {
        label: "bot.command",
        signature: 'bot.command("start", """Welcome!""")',
        description: "Обрабатывает slash-команду, например `/start`.",
      },
    ],
    code: `bot.hears(["price", "cost"], """
Pricing depends on the task. Tell me what exactly you need.
""")

bot.matches(r"(bug|error|не работает)", """
This looks like a technical issue. Please describe the steps to reproduce it.
""", flags="i")

bot.command("help", """
Describe the task, and I will route you to the right answer.
""")`,
  },
  {
    id: "aliases",
    title: "4. Python-стиль",
    summary:
      "В языке есть короткие и более Python-похожие алиасы. Это сделано, чтобы сценарии читались естественно для людей, которые привыкли к Python.",
    bullets: [
      "`bot.hears(...)` читается естественнее, чем `bot.rule_contains(...)`.",
      "`bot.matches(...)` и `bot.on_regex(...)` удобнее, чем более техническое имя `bot.rule_regex(...)`.",
      "`bot.reply(...)` можно использовать как короткий alias для `bot.default(...)`.",
      "`bot.escalate(...)` можно использовать как alias для `bot.handoff(...)`.",
    ],
    entries: [
      {
        label: "keyword aliases",
        signature: "bot.rule_contains == bot.on_text == bot.hears",
        description: "Три имени для одного и того же keyword-правила.",
      },
      {
        label: "regex aliases",
        signature: "bot.rule_regex == bot.on_regex == bot.matches",
        description: "Три имени для одного и того же regex-правила.",
      },
      {
        label: "fallback/handoff aliases",
        signature: "bot.reply == bot.default, bot.escalate == bot.handoff",
        description: "Удобные псевдонимы для более читаемого стиля.",
      },
    ],
    code: `# These pairs are equivalent:
bot.reply("""Fallback answer.""")
bot.default("""Fallback answer.""")

bot.escalate("""Pass complex cases to a human.""")
bot.handoff("""Pass complex cases to a human.""")

bot.hears(["manager"], """I can connect you to a human.""")
bot.on_text(["manager"], """I can connect you to a human.""")`,
  },
  {
    id: "examples",
    title: "5. Полный пример",
    summary:
      "Ниже — рабочий пример сценария в том стиле, который реально поддерживается редактором, автодополнением и рантаймом Shalter.",
    bullets: [
      "Импортируем `ShalterBot`.",
      "Создаём объект `bot`.",
      "Задаём greeting, guard, handoff и default.",
      "Добавляем keyword-, regex- и command-правила.",
    ],
    entries: [
      {
        label: "working program",
        signature: "ready-to-publish script",
        description: "Такой сценарий можно вставить в редактор и сразу опубликовать.",
      },
    ],
    code: `from shalter import ShalterBot

bot = ShalterBot(
    name="Sales Assistant",
    niche="Sales and support",
    goal="Understand the request and move the user to the next step.",
    tone="Friendly, calm, and precise.",
)

bot.greeting("""
Hello! I am the Shalter bot. Tell me what you need, and I will help.
""")

bot.guard("""
Do not invent prices, deadlines, or legal promises without confirmation.
""")

bot.hears(["hello", "hi", "привет"], """
Hello! I can help with product info, pricing, contacts, and next steps.
""")

bot.rule_contains(["price", "cost", "тариф"], """
Pricing depends on the task. Describe what you need, and I will guide you.
""")

bot.matches(r"(bug|error|не работает)", """
This looks like a technical issue. Please describe what broke and how to reproduce it.
""", flags="i")

bot.command("help", """
Describe your task in one message, and I will suggest the next step.
""")

bot.handoff("""
If the case is нестандартный, payment-related, or conflict-heavy, pass it to a human.
""")

bot.default("""
Tell me a bit more, and I will help you move forward.
""")`,
  },
]
