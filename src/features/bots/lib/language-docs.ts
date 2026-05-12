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

export const LANGUAGE_NAME = "Shalter Bot Script C#"

export const LANGUAGE_DOCS: LanguageDocSection[] = [
  {
    id: "spec",
    title: "1. Основа",
    summary:
      "Shalter Bot Script C# — это компактный DSL для сценариев ботов в стиле C#. Он не пытается быть полным C#, а берет знакомый синтаксис конструктора, методов и именованных аргументов.",
    bullets: [
      "Точка входа выглядит как `var bot = new ShalterBot(...)`.",
      "Именованные аргументы записываются через `name: \"...\"`.",
      "Для коротких строк используются `\"...\"`, для блоков ответа — `\"\"\"...\"\"\"`.",
      "Поддерживаются `using Shalter;`, `//`-комментарии и C#-подобные имена методов.",
    ],
    entries: [
      {
        label: "using",
        signature: "using Shalter;",
        description: "Подключает DSL сценариев Shalter.",
      },
      {
        label: "constructor",
        signature:
          'var bot = new ShalterBot(name: "Support", niche: "Sales", goal: "Help", tone: "Calm");',
        description: "Создает объект сценария и задает основные свойства бота.",
      },
    ],
    code: `using Shalter;

var bot = new ShalterBot(
    name: "Support Bot",
    niche: "Product support",
    goal: "Help users quickly and clearly.",
    tone: "Calm and precise."
);`,
  },
  {
    id: "blocks",
    title: "2. Системные блоки",
    summary:
      "Системные блоки задают базовое поведение бота: приветствие, ограничения, передачу человеку и fallback-ответ.",
    bullets: [
      "`bot.Greeting(...)` задает первое сообщение.",
      "`bot.Guard(...)` и `bot.Safety(...)` добавляют ограничения.",
      "`bot.Handoff(...)` и `bot.Escalate(...)` описывают передачу диалога человеку.",
      "`bot.Default(...)` и `bot.Reply(...)` отвечают за fallback.",
    ],
    entries: [
      {
        label: "bot.Greeting",
        signature: 'bot.Greeting("""Hello! How can I help?""");',
        description: "Первое сообщение в чате с ботом.",
      },
      {
        label: "bot.Guard",
        signature: 'bot.Guard("""Do not invent prices or deadlines.""");',
        description: "Общие ограничения, которые бот должен соблюдать.",
      },
      {
        label: "bot.Default",
        signature: 'bot.Default("""Tell me a bit more and I will help.""");',
        description: "Ответ по умолчанию, если ни одно правило не подошло.",
      },
    ],
    code: `bot.Greeting("""
Hello! Describe the task and I will help.
""");

bot.Guard("""
Do not invent prices, deadlines, or legal guarantees.
""");

bot.Handoff("""
Escalate payment disputes and нестандартные кейсы to a human.
""");

bot.Default("""
Tell me a bit more and I will suggest the next step.
""");`,
  },
  {
    id: "rules",
    title: "3. Правила",
    summary:
      "Правила маршрутизируют сообщения. Поддерживаются ключевые слова, regex и slash-команды.",
    bullets: [
      "`bot.OnText(...)`, `bot.RuleContains(...)` и `bot.Hears(...)` — keyword-правила.",
      "`bot.OnRegex(...)`, `bot.RuleRegex(...)` и `bot.Matches(...)` — regex-правила.",
      "`bot.Command(...)` и `bot.OnCommand(...)` — обработчики `/start`, `/help` и других команд.",
      "Для regex-флагов используется `flags: \"i\"`.",
    ],
    entries: [
      {
        label: "bot.OnText",
        signature: 'bot.OnText(new[] { "price", "cost" }, """Pricing depends on the task.""");',
        description: "Срабатывает по одному или нескольким ключевым словам.",
      },
      {
        label: "bot.OnRegex",
        signature: 'bot.OnRegex(@"(bug|error)", """This looks like a technical issue.""", flags: "i");',
        description: "Срабатывает по регулярному выражению.",
      },
      {
        label: "bot.Command",
        signature: 'bot.Command("help", """Describe the task and I will help.""");',
        description: "Срабатывает на slash-команду.",
      },
    ],
    code: `bot.OnText(new[] { "price", "cost" }, """
Pricing depends on the task. Tell me what exactly you need.
""");

bot.OnRegex(@"(bug|error|не работает)", """
This looks like a technical issue. Please describe the steps to reproduce it.
""", flags: "i");

bot.Command("help", """
Describe the task, and I will route you to the right answer.
""");`,
  },
  {
    id: "example",
    title: "4. Полный пример",
    summary:
      "Ниже пример сценария, который можно вставить в редактор и сразу публиковать.",
    bullets: [
      "Подключаем `using Shalter;`.",
      "Создаем `var bot = new ShalterBot(...)`.",
      "Добавляем greeting, guard, handoff и default.",
      "Описываем правила через `OnText`, `OnRegex` и `Command`.",
    ],
    entries: [
      {
        label: "working program",
        signature: "ready-to-publish script",
        description: "Рабочий сценарий в текущем C#-стиле.",
      },
    ],
    code: `using Shalter;

var bot = new ShalterBot(
    name: "Sales Assistant",
    niche: "Sales and support",
    goal: "Understand the request and move the user to the next step.",
    tone: "Friendly, calm, and precise."
);

bot.Greeting("""
Hello! I am the Shalter bot. Tell me what you need, and I will help.
""");

bot.Guard("""
Do not invent prices, deadlines, or legal promises without confirmation.
""");

bot.OnText(new[] { "hello", "hi", "привет" }, """
Hello! I can help with product info, pricing, contacts, and next steps.
""");

bot.OnText(new[] { "price", "cost", "тариф" }, """
Pricing depends on the task. Describe what you need, and I will guide you.
""");

bot.OnRegex(@"(bug|error|не работает)", """
This looks like a technical issue. Please describe what broke and how to reproduce it.
""", flags: "i");

bot.Command("help", """
Describe your task in one message, and I will suggest the next step.
""");

bot.Handoff("""
If the case is нестандартный, payment-related, or conflict-heavy, pass it to a human.
""");

bot.Default("""
Tell me a bit more, and I will help you move forward.
""");`,
  },
]
