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

export const LANGUAGE_NAME = "Aster"

export const LANGUAGE_DOCS: LanguageDocSection[] = [
  {
    id: "spec",
    title: "1. Базовая спецификация",
    summary:
      "Aster — универсальный язык общего назначения с философией Python: читаемость, отступы, батарейки в комплекте и опциональная строгая типизация.",
    bullets: [
      "Синтаксис опирается на отступы, именованные аргументы, классы, интерфейсы, функции первого класса и pattern matching.",
      "Асинхронность нативная: `async`, `await`, планировщик задач и structured concurrency встроены в рантайм.",
      "Типизация динамическая по умолчанию, но `strict`-режим включает проверку аннотаций и контрактов на уровне компиляции.",
      "Память управляется generational GC с аренами для короткоживущих объектов и zero-copy буферами для IO.",
      "Пакетный менеджер `aster pkg` и окружения `aster venv` встроены в дистрибутив языка.",
    ],
    entries: [
      {
        label: "fn",
        signature: "fn parse(path: String) -> Json",
        description: "Объявление функции с аннотациями и выводом типа там, где это безопасно.",
      },
      {
        label: "class",
        signature: "class Worker(Logger):",
        description: "ООП с наследованием, протоколами и dataclass-подобными полями.",
      },
      {
        label: "async",
        signature: "async fn fetch(url: String) -> Bytes",
        description: "Нативные корутины без сторонних event-loop библиотек.",
      },
    ],
    code: `module app.config

strict on

class ReportService:
    let base_url: String

    fn init(base_url: String):
        self.base_url = base_url

    async fn build(day: Date) -> Map[String, Int]:
        if day.is_weekend():
            return {"requests": 0}

        return {"requests": 42}`,
  },
  {
    id: "stdlib",
    title: "2. Стандартная библиотека",
    summary:
      "Aster — не DSL для ботов, а полноценный язык. Стандартная библиотека покрывает системное программирование, сеть, базы данных, конкурентность и обработку данных.",
    bullets: [
      "Модули `fs`, `path`, `env`, `process`, `time`, `collections`, `json`, `yaml`, `regex`, `math`, `crypto` доступны из коробки.",
      "Для сети встроены `http`, `websocket`, `rpc`, `dns`, `smtp`, `queue`, а для хранения — `sqlite`, `sql`, `cache`, `state`.",
      "Многопоточность и фоновые задачи идут через `concurrency`, `actors`, `channels`, `sync`, `workers`.",
      "Форматирование, логирование и observability закрывают `fmt`, `logger`, `metrics`, `trace`, `test`.",
    ],
    entries: [
      {
        label: "http",
        signature: "http.get(url, headers={})",
        description: "Асинхронный HTTP-клиент с connection pooling и retry policies.",
      },
      {
        label: "sqlite",
        signature: "sqlite.open(\"app.db\")",
        description: "Встроенная работа с SQLite без внешнего драйвера.",
      },
      {
        label: "fs",
        signature: "fs.write_text(path, content)",
        description: "Файловые операции с безопасными async-обёртками.",
      },
    ],
    code: `from aster import fs, http, json

async fn mirror_config(url: String, file: Path):
    response = await http.get(url)
    payload = json.parse(response.text)

    if payload["enabled"] == true:
        await fs.write_text(file, json.stringify(payload, indent=2))`,
  },
  {
    id: "telegram",
    title: "3. Встроенный модуль telegram",
    summary:
      "Главная суперсила Aster — стандартный модуль `telegram`, полностью покрывающий актуальный Telegram Bot API без установки сторонних пакетов.",
    bullets: [
      "Каждый метод Bot API отображается 1:1 в `telegram.Bot`: `send_message`, `send_photo`, `edit_message_text`, `delete_message`, `answer_inline_query` и так далее.",
      "Роутинг декларативный: `router.command`, `router.message`, `router.callback`, `router.inline`, `router.payment`, `router.webapp`.",
      "FSM встроен в модуль и умеет хранить состояние в памяти, Redis-подобном `state` backend или SQL-хранилище.",
      "Long-polling и webhook запускаются через единый `telegram.run(...)`, с graceful shutdown, автопереподключением и rate-limiting.",
    ],
    entries: [
      {
        label: "telegram.Bot",
        signature: "telegram.Bot(token: SecretString)",
        description: "Низкоуровневый клиент со всеми методами Telegram Bot API.",
      },
      {
        label: "telegram.Router",
        signature: "telegram.Router(name=\"main\")",
        description: "Декларативный роутер для команд, текста, callback query и inline-режима.",
      },
      {
        label: "telegram.FSM",
        signature: "telegram.FSM(storage=state.memory())",
        description: "Машина состояний для многошаговых диалогов.",
      },
      {
        label: "telegram.run",
        signature: "telegram.run(bot, router, mode=\"webhook\")",
        description: "Запуск polling/webhook с автонастройкой сервера и shutdown hooks.",
      },
    ],
    code: `from aster import telegram

bot = telegram.Bot(token=env.secret("BOT_TOKEN"))
router = telegram.Router(name="main")
dialogs = telegram.FSM(storage=telegram.state.memory())

@router.command("start")
async fn start(ctx: telegram.Context):
    await ctx.reply("Привет! Я работаю на стандартной библиотеке telegram.")`,
  },
  {
    id: "runtime",
    title: "4. Роутинг, FSM и middleware",
    summary:
      "Вокруг Telegram API строится полноценный runtime: цепочки middleware, фильтры, автоматические retry, лимиты и контекст выполнения.",
    bullets: [
      "Middleware бывают до роутинга, после роутинга и scoped — на конкретный router/group.",
      "Фильтры компонуются через `all`, `any`, `not`, а также типизированные предикаты обновлений.",
      "FSM-состояния описываются enum-классами и сериализуются в state storage автоматически.",
      "Ошибки Telegram API попадают в типизированную иерархию исключений с политиками retry/backoff.",
    ],
    entries: [
      {
        label: "@router.middleware",
        signature: "@router.middleware(stage=\"before\")",
        description: "Подключение цепочки обработки контекста до исполнения handler.",
      },
      {
        label: "ctx.state",
        signature: "await ctx.state.set(Form.waiting_email)",
        description: "Управление состояниями диалога и временными данными пользователя.",
      },
      {
        label: "telegram.filters",
        signature: "telegram.filters.command(\"start\")",
        description: "Набор встроенных фильтров для команд, текста, callback и чатов.",
      },
    ],
    code: `enum CheckoutState:
    waiting_email
    waiting_confirm

@router.message(text=True)
async fn collect_email(ctx: telegram.Context):
    if await ctx.state.is_(CheckoutState.waiting_email):
        await ctx.state.data.set("email", ctx.message.text)
        await ctx.state.set(CheckoutState.waiting_confirm)
        await ctx.reply("Подтвердите заказ кнопкой ниже.")`,
  },
  {
    id: "examples",
    title: "5. Примеры кода",
    summary:
      "Документация языка должна показывать не только Telegram, но и обычные прикладные задачи: HTTP, JSON, файлы, БД и конкурентность.",
    bullets: [
      "Пример общего назначения: JSON + async HTTP + запись результата в файл.",
      "Пример Telegram-бота: команды, кнопки, callback query, FSM и отправка фото.",
      "Пример production-обвязки: middleware, логирование, обработка ошибок, graceful shutdown.",
    ],
    entries: [
      {
        label: "Example 1",
        signature: "async fn fetch_report()",
        description: "Работа с HTTP, JSON и файловой системой.",
      },
      {
        label: "Example 2",
        signature: "@router.inline()",
        description: "Inline mode, клавиатуры и media replies.",
      },
      {
        label: "Example 3",
        signature: "runtime.on_shutdown(...)",
        description: "Очистка ресурсов и controlled shutdown.",
      },
    ],
    code: `async fn sync_feed():
    response = await http.get("https://api.example.com/feed")
    items = json.parse(response.text)
    await fs.write_text("feed.json", json.stringify(items, indent=2))

@router.callback("buy")
async fn buy_now(ctx: telegram.Context):
    await ctx.answer("Переходим к оплате")
    await ctx.reply_photo("catalog/item.png", caption="Ваш товар")`,
  },
  {
    id: "deploy",
    title: "6. Реализация и деплой",
    summary:
      "Aster задуман как байткодный язык с JIT-оптимизацией горячих участков и быстрым сетевым рантаймом, чтобы Telegram был встроенной сильной стороной, а не внешним фреймворком.",
    bullets: [
      "Компиляция идёт в байткод Aster VM, затем горячие пути могут JIT-компилироваться в нативный код.",
      "FFI позволяет подключать C/Rust-библиотеки через безопасные binding-модули.",
      "Кроссплатформенность целится в Linux, macOS и Windows, плюс минимальный контейнерный runtime для серверов.",
      "Деплой выглядит как `aster build` или `aster run bot.ast`, без отдельных зависимостей для Telegram-части.",
    ],
    entries: [
      {
        label: "aster pkg",
        signature: "aster pkg add redis",
        description: "Установка сторонних пакетов и привязка lockfile.",
      },
      {
        label: "aster run",
        signature: "aster run app.ast",
        description: "Запуск приложения в dev/runtime режиме.",
      },
      {
        label: "aster build",
        signature: "aster build --target linux-x64",
        description: "Сборка self-contained артефакта для деплоя.",
      },
    ],
    code: `# build.aster
target "linux-x64"
entry "bot/main.ast"
optimize "balanced"
embed stdlib.telegram
`,
  },
]
