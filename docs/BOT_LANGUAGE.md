# Shalter Bot Script

## Что это

`Shalter Bot Script` — это Python-подобный язык сценариев для ботов внутри Shalter.

Он нужен для:

- описания приветствия;
- задания ограничений и safety-правил;
- обработки сообщений по ключевым словам;
- обработки сообщений по регулярным выражениям;
- обработки slash-команд;
- передачи сложных диалогов человеку.

Это не отдельный универсальный язык программирования уровня Python. Это компактный DSL, который выглядит как Python и поддерживается редактором, автодополнением и рантаймом Shalter.

## Базовый синтаксис

```python
from shalter import ShalterBot

bot = ShalterBot(
    name="Support Bot",
    niche="Support",
    goal="Help the user clearly and quickly.",
    tone="Calm and precise.",
)
```

Поддерживаются:

- строки `"..."`;
- многострочные блоки `"""..."""`;
- raw-строки `r"..."`;
- комментарии `# ...`;
- именованные аргументы.

## Системные блоки

### Приветствие

```python
bot.greeting("""
Hello! How can I help?
""")
```

### Ограничения

```python
bot.guard("""
Do not invent prices, deadlines, or legal guarantees.
""")
```

Алиас:

```python
bot.safety("""
Do not ask for unsafe personal data.
""")
```

### Передача человеку

```python
bot.handoff("""
Escalate payment disputes and нестандартные cases to a human.
""")
```

Алиас:

```python
bot.escalate("""
Pass complex cases to a human.
""")
```

### Ответ по умолчанию

```python
bot.default("""
Tell me a bit more and I will help.
""")
```

Алиас:

```python
bot.reply("""
Tell me a bit more and I will help.
""")
```

## Правила

### Ключевые слова

```python
bot.rule_contains(["price", "cost"], """
Pricing depends on the task.
""")
```

Python-подобные алиасы:

```python
bot.on_text(["price", "cost"], """
Pricing depends on the task.
""")

bot.hears(["price", "cost"], """
Pricing depends on the task.
""")
```

### Регулярные выражения

```python
bot.rule_regex(r"(bug|error)", """
This looks like a technical issue.
""", flags="i")
```

Алиасы:

```python
bot.on_regex(r"(bug|error)", """
This looks like a technical issue.
""", flags="i")

bot.matches(r"(bug|error)", """
This looks like a technical issue.
""", flags="i")
```

### Команды

```python
bot.command("start", """
Welcome to the bot.
""")
```

Алиас:

```python
bot.on_command("help", """
Ask a question and I will help.
""")
```

## Полный пример

```python
from shalter import ShalterBot

bot = ShalterBot(
    name="Sales Assistant",
    niche="Sales and support",
    goal="Understand the request and guide the user to the next step.",
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
""")
```

## Что реально поддерживается рантаймом

Сейчас рантайм понимает:

- `from shalter import ShalterBot`
- `bot = ShalterBot(...)`
- `bot.greeting(...)`
- `bot.guard(...)`, `bot.safety(...)`
- `bot.handoff(...)`, `bot.escalate(...)`
- `bot.default(...)`, `bot.reply(...)`
- `bot.rule_contains(...)`, `bot.on_text(...)`, `bot.hears(...)`
- `bot.rule_regex(...)`, `bot.on_regex(...)`, `bot.matches(...)`
- `bot.command(...)`, `bot.on_command(...)`
- `flags="i"` для regex-правил

Если нужен следующий шаг, можно расширить язык ещё сильнее в Python-сторону: `if/else`, переменные, функции-хелперы, шаблоны ответов и capture groups из regex.
