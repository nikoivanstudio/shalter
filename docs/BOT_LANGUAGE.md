# Aster

## 1. Базовая спецификация языка

`Aster` — универсальный язык программирования общего назначения с философией Python:
читаемость, явность, отступы для блоков, батарейки в комплекте и встроенная поддержка
Telegram как части стандартной библиотеки.

Ключевые свойства:

- Turing-полный, подходит не только для ботов, но и для backend, CLI, автоматизации и data-processing
- динамическая типизация по умолчанию
- опциональный `strict`-режим для более жёсткой проверки аннотаций
- нативные `async/await`
- ООП, функциональные паттерны, итераторы, match/case, модули, исключения
- встроенный пакетный менеджер и виртуальные окружения

Пример синтаксиса:

```aster
module app.main

strict on

class UserService:
    let api_url: String

    fn init(api_url: String):
        self.api_url = api_url

    async fn fetch_user(user_id: Int) -> Map[String, Any]:
        response = await http.get(f"{self.api_url}/users/{user_id}")
        return json.parse(response.text)

fn main():
    service = UserService("https://api.example.com")
    print(service)
```

Асинхронная модель:

- `async fn` создаёт корутину
- `await` приостанавливает задачу без блокировки потока
- рантайм использует встроенный event loop и structured concurrency
- фоновые задачи запускаются через `spawn`, а группы задач через `task_group`

Система типов:

- базовые типы: `Int`, `Float`, `Bool`, `String`, `Bytes`, `Path`, `Date`, `Duration`
- контейнеры: `List[T]`, `Map[K, V]`, `Set[T]`, `Option[T]`, `Result[T, E]`
- аннотации необязательны, но рекомендуются для публичного API

Управление памятью:

- generational GC
- zero-copy буферы для сетевых и файловых операций
- безопасный FFI-слой для тяжёлых расширений

Пакеты и окружения:

```bash
aster venv .venv
aster pkg add redis
aster pkg sync
aster run app.ast
```

## 2. Стандартная библиотека общего назначения

`Aster` — полноценный язык общего назначения. По умолчанию доступны модули:

- `fs`, `path`, `env`, `process`
- `json`, `yaml`, `toml`, `csv`
- `http`, `websocket`, `dns`
- `sqlite`, `sql`, `cache`, `state`
- `time`, `math`, `regex`, `crypto`
- `collections`, `iter`, `concurrency`, `sync`
- `logger`, `metrics`, `trace`, `test`

Пример:

```aster
from aster import fs, http, json

async fn sync_feed():
    response = await http.get("https://api.example.com/feed")
    payload = json.parse(response.text)
    await fs.write_text("feed.json", json.stringify(payload, indent=2))
```

## 3. Встроенная библиотека `telegram`

Главная особенность `Aster` — стандартный модуль `telegram`, который из коробки покрывает
весь Telegram Bot API.

Архитектура:

- `telegram.Bot` — низкоуровневый клиент всех методов Bot API
- `telegram.Router` — декларативный роутинг и хендлеры
- `telegram.FSM` — машина состояний
- `telegram.filters` — встроенные фильтры
- `telegram.run(...)` — запуск polling или webhook

### Полный mapping Bot API

Примеры методов:

- `send_message`
- `edit_message_text`
- `send_photo`
- `send_document`
- `delete_message`
- `answer_callback_query`
- `answer_inline_query`
- `set_webhook`
- `get_updates`

### Роутинг и хендлеры

```aster
from aster import telegram

bot = telegram.Bot(token=env.secret("BOT_TOKEN"))
router = telegram.Router(name="main")

@router.command("start")
async fn start(ctx: telegram.Context):
    await ctx.reply("Привет!")

@router.callback("buy")
async fn buy(ctx: telegram.Context):
    await ctx.answer("Открываю оплату")
```

### FSM

```aster
enum FormState:
    waiting_name
    waiting_email

dialogs = telegram.FSM(storage=telegram.state.memory())

@router.command("form")
async fn form_start(ctx: telegram.Context):
    await ctx.state.set(FormState.waiting_name)
    await ctx.reply("Введите имя")
```

### Middleware и retry

- `@router.middleware(stage="before")`
- `telegram.rate_limit(per_user=20, per_minute=60)`
- встроенные retry/backoff для сетевых ошибок
- типизированные исключения Telegram API

### Клавиатуры и форматирование

- `telegram.inline_keyboard(...)`
- `telegram.reply_keyboard(...)`
- `telegram.markdown.escape(...)`
- `telegram.html.bold(...)`

### Long-polling и webhook

```aster
telegram.run(
    bot=bot,
    router=router,
    mode="webhook",
    host="0.0.0.0",
    port=8443,
)
```

## 4. Примеры кода

### Пример 1: JSON + async HTTP + файлы

```aster
from aster import fs, http, json

async fn download_config():
    response = await http.get("https://example.com/config.json")
    data = json.parse(response.text)
    await fs.write_text("config.json", json.stringify(data, indent=2))
```

### Пример 2: Telegram-бот

```aster
from aster import env, telegram

bot = telegram.Bot(token=env.secret("BOT_TOKEN"))
router = telegram.Router(name="shop")
state = telegram.FSM(storage=telegram.state.memory())

@router.command("start")
async fn start(ctx: telegram.Context):
    kb = telegram.inline_keyboard([
        [telegram.button("Каталог", callback="catalog")],
    ])
    await ctx.reply("Добро пожаловать", reply_markup=kb)

@router.callback("catalog")
async fn catalog(ctx: telegram.Context):
    await ctx.reply_photo("images/item.png", caption="Товар дня")

@router.inline()
async fn inline_search(ctx: telegram.InlineContext):
    results = [
        telegram.inline_article(
            id="1",
            title="Помощь",
            text="Напишите вопрос, и бот поможет.",
        )
    ]
    await ctx.answer(results)
```

### Пример 3: middleware и graceful shutdown

```aster
@router.middleware(stage="before")
async fn log_request(ctx: telegram.Context, next):
    logger.info("incoming update", update_id=ctx.update.id)
    return await next()

runtime = telegram.run(bot=bot, router=router, mode="polling")

runtime.on_shutdown(fn ():
    logger.info("bot stopped")
)
```

## 5. Сравнение с Python + aiogram / telebot

- меньше внешних зависимостей
- единый рантайм без отдельного выбора фреймворка
- меньше glue-code между HTTP, FSM, webhook, retry и Bot API
- ниже накладные расходы за счёт встроенного сетевого рантайма и байткода
- проще деплой: `aster run`, `aster build`

Для Python-разработчика порог входа низкий: синтаксис намеренно близок к Python.

## 6. Технические детали реализации

- исполнение: байткод + JIT для горячих участков
- FFI: безопасные binding-модули к C/Rust
- кроссплатформенность: Linux, macOS, Windows
- сторонние пакеты подключаются через `aster pkg`

Идея `Aster`: это сначала универсальный язык общего назначения, и только потом язык,
в котором Telegram встроен в стандартную библиотеку на уровне платформы.
