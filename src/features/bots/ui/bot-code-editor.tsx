"use client"

import { useMemo, useRef, useState } from "react"

type BotCodeEditorProps = {
  value: string
  onChange: (value: string) => void
  className?: string
}

type TokenKind =
  | "plain"
  | "keyword"
  | "type"
  | "method"
  | "string"
  | "regex"
  | "comment"
  | "number"

type Token = {
  kind: TokenKind
  value: string
}

type EditorSuggestion = {
  label: string
  detail: string
  insertText: string
}

type SuggestionState = {
  start: number
  end: number
  items: EditorSuggestion[]
}

const BOT_METHOD_NAMES = [
  "greeting",
  "guard",
  "safety",
  "handoff",
  "escalate",
  "default",
  "reply",
  "rule_contains",
  "rule_regex",
  "command",
  "on_command",
  "on_text",
  "on_regex",
  "hears",
  "matches",
] as const

const TOKEN_PATTERN = new RegExp(
  `(from|import)\\b|(ShalterBot|Bot)\\b|(\\b(?:bot)\\.(?:${BOT_METHOD_NAMES.join("|")})\\b)|("""[\\s\\S]*?"""|r?"[^"\\n]*")|(#.*$)|(\\b\\d+\\b)|(flags)\\b`,
  "gm"
)

const EDITOR_SUGGESTIONS: EditorSuggestion[] = [
  {
    label: "from shalter import ShalterBot",
    detail: "Импорт основной библиотеки",
    insertText: "from shalter import ShalterBot",
  },
  {
    label: "bot = ShalterBot(...)",
    detail: "Создание бота",
    insertText:
      'bot = ShalterBot(\n    name="Новый бот",\n    niche="Поддержка",\n    goal="Помогать пользователю.",\n    tone="Спокойный и точный.",\n)',
  },
  {
    label: "bot.greeting(...)",
    detail: "Первое сообщение",
    insertText: 'bot.greeting("""\nПривет! Чем помочь?\n""")',
  },
  {
    label: "bot.default(...)",
    detail: "Ответ по умолчанию",
    insertText: 'bot.default("""\nОпиши задачу чуть подробнее, и я помогу.\n""")',
  },
  {
    label: "bot.reply(...)",
    detail: "Алиас bot.default(...)",
    insertText: 'bot.reply("""\nОпиши задачу чуть подробнее, и я помогу.\n""")',
  },
  {
    label: "bot.guard(...)",
    detail: "Защитное примечание",
    insertText: 'bot.guard("""\nНе обещай неподтвержденные цены и сроки.\n""")',
  },
  {
    label: "bot.safety(...)",
    detail: "Алиас bot.guard(...)",
    insertText: 'bot.safety("""\nНе обещай неподтвержденные цены и сроки.\n""")',
  },
  {
    label: "bot.handoff(...)",
    detail: "Передача человеку",
    insertText: 'bot.handoff("""\nЕсли вопрос нестандартный, передай диалог человеку.\n""")',
  },
  {
    label: "bot.escalate(...)",
    detail: "Алиас bot.handoff(...)",
    insertText: 'bot.escalate("""\nЕсли вопрос нестандартный, передай диалог человеку.\n""")',
  },
  {
    label: "bot.rule_contains(...)",
    detail: "Правило по ключевым словам",
    insertText: 'bot.rule_contains(["цена", "тариф"], """\nСтоимость зависит от задачи.\n""")',
  },
  {
    label: "bot.on_text(...)",
    detail: "Алиас текстового правила",
    insertText: 'bot.on_text(["менеджер", "оператор"], """\nМогу передать диалог человеку.\n""")',
  },
  {
    label: "bot.hears(...)",
    detail: "Python-style алиас текстового правила",
    insertText: 'bot.hears(["доставка", "срок"], """\nПодскажу по срокам и доставке.\n""")',
  },
  {
    label: "bot.rule_regex(...)",
    detail: "Правило по регулярному выражению",
    insertText: 'bot.rule_regex(r"(ошибка|bug)", """\nПохоже на техническую проблему.\n""", flags="i")',
  },
  {
    label: "bot.on_regex(...)",
    detail: "Алиас regex-правила",
    insertText: 'bot.on_regex(r"^/debug$", """\nКоманда диагностики принята.\n""", flags="i")',
  },
  {
    label: "bot.matches(...)",
    detail: "Python-style алиас regex-правила",
    insertText: 'bot.matches(r"(оплата|платеж)", """\nПодскажу по оплате.\n""", flags="i")',
  },
  {
    label: "bot.command(...)",
    detail: "Обработчик команды",
    insertText: 'bot.command("start", """\nПривет! Это команда /start.\n""")',
  },
  {
    label: "bot.on_command(...)",
    detail: "Алиас команды",
    insertText: 'bot.on_command("help", """\nНапиши вопрос, и я помогу.\n""")',
  },
]

function tokenizeBotScript(source: string) {
  const tokens: Token[] = []
  let cursor = 0

  for (const match of source.matchAll(TOKEN_PATTERN)) {
    const start = match.index ?? 0
    const matched = match[0] ?? ""

    if (start > cursor) {
      tokens.push({ kind: "plain", value: source.slice(cursor, start) })
    }

    const kind: TokenKind = match[1]
      ? "keyword"
      : match[2]
        ? "type"
        : match[3]
          ? "method"
          : match[4]
            ? match[4].startsWith('r"') || match[4].startsWith('r"""')
              ? "regex"
              : "string"
            : match[5]
              ? "comment"
              : match[6]
                ? "number"
                : "keyword"

    tokens.push({ kind, value: matched })
    cursor = start + matched.length
  }

  if (cursor < source.length) {
    tokens.push({ kind: "plain", value: source.slice(cursor) })
  }

  return tokens
}

function tokenClassName(kind: TokenKind) {
  switch (kind) {
    case "keyword":
      return "text-sky-300"
    case "type":
      return "text-violet-300"
    case "method":
      return "text-amber-300"
    case "string":
      return "text-emerald-300"
    case "regex":
      return "text-rose-300"
    case "comment":
      return "text-slate-500"
    case "number":
      return "text-cyan-300"
    default:
      return "text-slate-100"
  }
}

function getWordBounds(source: string, cursor: number) {
  let start = cursor
  let end = cursor

  while (start > 0 && /[a-zA-Z0-9_.]/.test(source[start - 1] ?? "")) {
    start -= 1
  }

  while (end < source.length && /[a-zA-Z0-9_.]/.test(source[end] ?? "")) {
    end += 1
  }

  return { start, end }
}

function buildSuggestionState(source: string, cursor: number): SuggestionState | null {
  const { start, end } = getWordBounds(source, cursor)
  const query = source.slice(start, end).trim().toLowerCase()
  const currentLine = source.slice(source.lastIndexOf("\n", cursor - 1) + 1, cursor)
  const showBotMethodsOnly = currentLine.includes("bot.")

  const items = EDITOR_SUGGESTIONS.filter((item) => {
    if (showBotMethodsOnly && !item.label.startsWith("bot.")) {
      return false
    }

    if (!query) {
      return item.label.startsWith(showBotMethodsOnly ? "bot." : "from") || item.label.startsWith("bot =")
    }

    return item.label.toLowerCase().includes(query)
  }).slice(0, 8)

  if (items.length === 0) {
    return null
  }

  return { start, end, items }
}

export function BotCodeEditor({ value, onChange, className = "" }: BotCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const highlightRef = useRef<HTMLPreElement | null>(null)
  const [cursorPosition, setCursorPosition] = useState(value.length)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const tokens = useMemo(() => tokenizeBotScript(value), [value])
  const suggestionState = useMemo(
    () => buildSuggestionState(value, cursorPosition),
    [cursorPosition, value]
  )

  function syncScroll() {
    if (!textareaRef.current || !highlightRef.current) {
      return
    }

    highlightRef.current.scrollTop = textareaRef.current.scrollTop
    highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
  }

  function applySuggestion(item: EditorSuggestion) {
    const textarea = textareaRef.current
    if (!textarea || !suggestionState) {
      return
    }

    const nextValue =
      value.slice(0, suggestionState.start) +
      item.insertText +
      value.slice(suggestionState.end)

    onChange(nextValue)

    requestAnimationFrame(() => {
      const nextCursor = suggestionState.start + item.insertText.length
      textarea.focus()
      textarea.setSelectionRange(nextCursor, nextCursor)
    })
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border/70 bg-[#0b1220] shadow-[0_20px_60px_rgba(2,6,23,0.35)] ${className}`}
    >
      <pre
        ref={highlightRef}
        aria-hidden="true"
        className="pointer-events-none min-h-[38rem] overflow-auto px-4 py-3 font-mono text-sm leading-6 whitespace-pre-wrap"
      >
        {tokens.length > 0 ? (
          tokens.map((token, index) => (
            <span key={`${index}-${token.kind}`} className={tokenClassName(token.kind)}>
              {token.value}
            </span>
          ))
        ) : (
          <span className="text-slate-500">from shalter import ShalterBot</span>
        )}
        {value.endsWith("\n") ? "\n" : null}
      </pre>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setCursorPosition(event.target.selectionStart)
          setSelectedSuggestionIndex(0)
        }}
        onSelect={(event) => {
          setCursorPosition((event.target as HTMLTextAreaElement).selectionStart)
        }}
        onClick={() => setSelectedSuggestionIndex(0)}
        onKeyDown={(event) => {
          if (!suggestionState || suggestionState.items.length === 0) {
            return
          }

          if (event.key === "ArrowDown") {
            event.preventDefault()
            setSelectedSuggestionIndex((prev) => (prev + 1) % suggestionState.items.length)
            return
          }

          if (event.key === "ArrowUp") {
            event.preventDefault()
            setSelectedSuggestionIndex((prev) =>
              prev === 0 ? suggestionState.items.length - 1 : prev - 1
            )
            return
          }

          if (event.key === "Tab" || event.key === "Enter") {
            event.preventDefault()
            applySuggestion(
              suggestionState.items[
                Math.min(selectedSuggestionIndex, suggestionState.items.length - 1)
              ] as EditorSuggestion
            )
            setSelectedSuggestionIndex(0)
            return
          }

          if (event.key === "Escape") {
            setSelectedSuggestionIndex(0)
          }
        }}
        onScroll={syncScroll}
        spellCheck={false}
        className="absolute inset-0 min-h-[38rem] w-full resize-none bg-transparent px-4 py-3 font-mono text-sm leading-6 text-transparent caret-slate-100 outline-none selection:bg-sky-500/30"
      />

      {suggestionState ? (
        <div className="absolute right-3 top-3 z-10 w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur">
          <p className="px-2 pb-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
            Подсказки Shalter
          </p>
          <div className="space-y-1">
            {suggestionState.items.map((item, index) => {
              const active = index === Math.min(selectedSuggestionIndex, suggestionState.items.length - 1)

              return (
                <button
                  key={item.label}
                  type="button"
                  className={`flex w-full items-start justify-between gap-3 rounded-xl px-2 py-2 text-left ${
                    active ? "bg-sky-500/15 text-white" : "text-slate-200 hover:bg-white/5"
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    applySuggestion(item)
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs">{item.label}</span>
                    <span className="block truncate text-[11px] text-slate-400">{item.detail}</span>
                  </span>
                  <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-400">
                    {active ? "Enter" : "Tab"}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
