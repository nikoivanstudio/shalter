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
  documentation: string
  example?: string
  insertText: string
  kind: "import" | "constructor" | "method" | "snippet" | "argument"
  searchTerms?: string[]
}

type SuggestionState = {
  start: number
  end: number
  query: string
  items: EditorSuggestion[]
}

type SuggestionContext = {
  currentLine: string
  rawQuery: string
  query: string
  showBotMethodsOnly: boolean
  isConstructorContext: boolean
  isFlagsContext: boolean
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
    detail: "Import",
    documentation: "Import the main Shalter bot class before declaring any rules.",
    example: "from shalter import ShalterBot",
    insertText: "from shalter import ShalterBot",
    kind: "import",
  },
  {
    label: "bot = ShalterBot(...)",
    detail: "Create bot",
    documentation: "Create the bot object and define its identity, niche, goal, and tone.",
    example: 'bot = ShalterBot(name="Support", niche="Help", goal="Answer questions")',
    insertText:
      'bot = ShalterBot(\n    name="New bot",\n    niche="Support",\n    goal="Help the user clearly.",\n    tone="Calm and precise.",\n)',
    kind: "constructor",
  },
  {
    label: "name=",
    detail: "Constructor argument",
    documentation: "Display name of the bot in the profile and chat header.",
    example: 'name="Support Bot"',
    insertText: 'name="New bot"',
    kind: "argument",
    searchTerms: ["constructor", "title", "bot name"],
  },
  {
    label: "niche=",
    detail: "Constructor argument",
    documentation: "The topic or specialization of the bot.",
    example: 'niche="Sales and support"',
    insertText: 'niche="Support"',
    kind: "argument",
    searchTerms: ["domain", "specialization", "topic"],
  },
  {
    label: "goal=",
    detail: "Constructor argument",
    documentation: "The main job the bot should accomplish in the dialogue.",
    example: 'goal="Help users choose the right plan"',
    insertText: 'goal="Help the user clearly."',
    kind: "argument",
    searchTerms: ["purpose", "mission", "target"],
  },
  {
    label: "tone=",
    detail: "Constructor argument",
    documentation: "The style and mood the bot should use in responses.",
    example: 'tone="Calm, precise, friendly."',
    insertText: 'tone="Calm and precise."',
    kind: "argument",
    searchTerms: ["style", "voice", "mood"],
  },
  {
    label: "bot.greeting(...)",
    detail: "Greeting",
    documentation: "First message users see when they open the bot conversation.",
    example: 'bot.greeting("""\nHello! How can I help?\n""")',
    insertText: 'bot.greeting("""\nHello! How can I help?\n""")',
    kind: "method",
  },
  {
    label: "bot.default(...)",
    detail: "Fallback reply",
    documentation: "Reply used when no keyword, regex, or command rule matches.",
    example: 'bot.default("""\nTell me a bit more and I will help.\n""")',
    insertText: 'bot.default("""\nTell me a bit more and I will help.\n""")',
    kind: "method",
  },
  {
    label: "bot.reply(...)",
    detail: "Alias of default",
    documentation: "Alias for bot.default when you want a cleaner DSL style.",
    example: 'bot.reply("""\nDescribe the task in more detail.\n""")',
    insertText: 'bot.reply("""\nDescribe the task in more detail.\n""")',
    kind: "method",
  },
  {
    label: "bot.guard(...)",
    detail: "Guardrail",
    documentation: "Adds safety and business constraints the bot must respect.",
    example: 'bot.guard("""\nDo not invent prices or deadlines.\n""")',
    insertText: 'bot.guard("""\nDo not invent prices or deadlines.\n""")',
    kind: "method",
  },
  {
    label: "bot.safety(...)",
    detail: "Alias of guard",
    documentation: "Alias for bot.guard with the same behavior.",
    example: 'bot.safety("""\nDo not ask for unsafe personal data.\n""")',
    insertText: 'bot.safety("""\nDo not ask for unsafe personal data.\n""")',
    kind: "method",
  },
  {
    label: "bot.handoff(...)",
    detail: "Human transfer",
    documentation: "Explains when the dialog should be escalated to a real person.",
    example: 'bot.handoff("""\nEscalate refund disputes to a manager.\n""")',
    insertText: 'bot.handoff("""\nEscalate complex or custom cases to a human.\n""")',
    kind: "method",
  },
  {
    label: "bot.escalate(...)",
    detail: "Alias of handoff",
    documentation: "Alias for bot.handoff for a more Python-like naming style.",
    example: 'bot.escalate("""\nPass legal issues to a manager.\n""")',
    insertText: 'bot.escalate("""\nPass legal issues to a manager.\n""")',
    kind: "method",
  },
  {
    label: "bot.rule_contains(...)",
    detail: "Keyword rule",
    documentation: "Matches incoming text by one or more keywords.",
    example: 'bot.rule_contains(["price", "cost"], """\nPricing depends on the task.\n""")',
    insertText: 'bot.rule_contains(["price", "cost"], """\nPricing depends on the task.\n""")',
    kind: "method",
  },
  {
    label: "bot.on_text(...)",
    detail: "Alias of keyword rule",
    documentation: "Alias for bot.rule_contains.",
    example: 'bot.on_text(["manager"], """\nI can transfer you to a human.\n""")',
    insertText: 'bot.on_text(["manager", "operator"], """\nI can transfer you to a human.\n""")',
    kind: "method",
  },
  {
    label: "bot.hears(...)",
    detail: "Python-style keyword rule",
    documentation: "Python-style alias for keyword matching.",
    example: 'bot.hears(["delivery"], """\nI can explain delivery times.\n""")',
    insertText: 'bot.hears(["delivery", "timing"], """\nI can explain delivery times.\n""")',
    kind: "method",
  },
  {
    label: "bot.rule_regex(...)",
    detail: "Regex rule",
    documentation: "Matches incoming text with a regular expression.",
    example: 'bot.rule_regex(r"(bug|error)", """\nThis looks like a technical issue.\n""", flags="i")',
    insertText: 'bot.rule_regex(r"(bug|error)", """\nThis looks like a technical issue.\n""", flags="i")',
    kind: "method",
  },
  {
    label: "bot.on_regex(...)",
    detail: "Alias of regex rule",
    documentation: "Alias for bot.rule_regex.",
    example: 'bot.on_regex(r"^/debug$", """\nDebug mode enabled.\n""", flags="i")',
    insertText: 'bot.on_regex(r"^/debug$", """\nDebug mode enabled.\n""", flags="i")',
    kind: "method",
  },
  {
    label: "bot.matches(...)",
    detail: "Python-style regex rule",
    documentation: "Python-style alias for regex matching.",
    example: 'bot.matches(r"(payment|billing)", """\nI can help with billing.\n""", flags="i")',
    insertText: 'bot.matches(r"(payment|billing)", """\nI can help with billing.\n""", flags="i")',
    kind: "method",
  },
  {
    label: "bot.command(...)",
    detail: "Command handler",
    documentation: "Registers a slash command, for example /start or /help.",
    example: 'bot.command("start", """\nWelcome to the bot.\n""")',
    insertText: 'bot.command("start", """\nWelcome to the bot.\n""")',
    kind: "method",
  },
  {
    label: "bot.on_command(...)",
    detail: "Alias of command",
    documentation: "Alias for bot.command.",
    example: 'bot.on_command("help", """\nAsk a question and I will help.\n""")',
    insertText: 'bot.on_command("help", """\nAsk a question and I will help.\n""")',
    kind: "method",
  },
  {
    label: 'flags="i"',
    detail: "Regex flags",
    documentation: "Case-insensitive regex matching. Use inside bot.rule_regex(...) or bot.matches(...).",
    example: 'flags="i"',
    insertText: 'flags="i"',
    kind: "argument",
    searchTerms: ["regex", "ignorecase", "case insensitive"],
  },
  {
    label: "# comment",
    detail: "Comment",
    documentation: "Leave notes in the bot script. Comments are ignored by the parser.",
    example: "# pricing rules",
    insertText: "# ",
    kind: "snippet",
    searchTerms: ["note", "annotation"],
  },
  {
    label: "full bot template",
    detail: "Starter program",
    documentation: "Insert a full working bot with constructor, greeting, guard, rules, and fallback.",
    insertText:
      'from shalter import ShalterBot\n\nbot = ShalterBot(\n    name="New bot",\n    niche="Support",\n    goal="Help the user clearly.",\n    tone="Calm and precise.",\n)\n\nbot.greeting("""\nHello! How can I help?\n""")\n\nbot.guard("""\nDo not invent prices, deadlines, or legal guarantees.\n""")\n\nbot.hears(["price", "cost"], """\nPricing depends on the task.\n""")\n\nbot.default("""\nTell me a bit more and I will help.\n""")',
    kind: "snippet",
    searchTerms: ["template", "starter", "program"],
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

function getSuggestionContext(source: string, cursor: number, start: number, end: number): SuggestionContext {
  const rawQuery = source.slice(start, end).trim().toLowerCase()
  const query = rawQuery.includes(".") ? rawQuery.slice(rawQuery.lastIndexOf(".") + 1) : rawQuery
  const currentLine = source.slice(source.lastIndexOf("\n", cursor - 1) + 1, cursor)
  const showBotMethodsOnly = currentLine.includes("bot.")
  const linePrefix = currentLine.trimStart()
  const isConstructorContext =
    /(?:ShalterBot|Bot)\s*\([\s\S]*$/m.test(source.slice(0, cursor)) &&
    !/\)\s*$/.test(source.slice(0, cursor))
  const isFlagsContext = /bot\.(?:rule_regex|on_regex|matches)\([\s\S]*$/m.test(source.slice(0, cursor))

  return {
    currentLine: linePrefix,
    rawQuery,
    query,
    showBotMethodsOnly,
    isConstructorContext,
    isFlagsContext,
  }
}

function scoreSuggestion(item: EditorSuggestion, context: SuggestionContext) {
  if (context.showBotMethodsOnly && item.kind !== "method") {
    return -1
  }

  if (context.isConstructorContext && item.kind === "method") {
    return -1
  }

  if (context.isFlagsContext && item.label === 'flags="i"') {
    return 200
  }

  const label = item.label.toLowerCase()
  const shortLabel = label.startsWith("bot.") ? label.slice(4) : label
  const searchSpace = [label, shortLabel, item.detail.toLowerCase(), item.documentation.toLowerCase()]
    .concat((item.searchTerms ?? []).map((term) => term.toLowerCase()))
    .join(" ")

  if (!context.query) {
    let base = 0

    if (context.showBotMethodsOnly && item.kind === "method") {
      base += 120
    }

    if (context.isConstructorContext && item.kind === "argument") {
      base += 120
    }

    if (!context.showBotMethodsOnly && !context.isConstructorContext) {
      if (item.kind === "import") base += 80
      if (item.kind === "constructor") base += 70
      if (item.kind === "method") base += 40
      if (item.kind === "snippet") base += 20
    }

    return base
  }

  let score = -1
  const query = context.query

  if (shortLabel === query || label === query) score = 150
  else if (shortLabel.startsWith(query)) score = 130
  else if (label.startsWith(query)) score = 120
  else if (shortLabel.split(/[^a-z0-9]+/).some((part) => part.startsWith(query))) score = 110
  else if (searchSpace.includes(query)) score = 70

  if (score < 0) {
    return -1
  }

  if (context.showBotMethodsOnly && item.kind === "method") {
    score += 25
  }

  if (context.isConstructorContext && item.kind === "argument") {
    score += 25
  }

  if (item.kind === "method") score += 8
  if (item.kind === "argument") score += 6
  if (item.kind === "constructor") score += 4

  return score
}

function buildSuggestionState(source: string, cursor: number): SuggestionState | null {
  const { start, end } = getWordBounds(source, cursor)
  const context = getSuggestionContext(source, cursor, start, end)
  const items = EDITOR_SUGGESTIONS.map((item) => ({
    item,
    score: scoreSuggestion(item, context),
  }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.item.label.localeCompare(right.item.label)
    })
    .slice(0, 8)
    .map((entry) => entry.item)

  if (items.length === 0) {
    return null
  }

  return { start, end, query: context.query, items }
}

function shouldOpenSuggestions(nextValue: string, cursor: number) {
  const typed = nextValue[cursor - 1] ?? ""
  return /[a-zA-Z_.]/.test(typed) || nextValue.trim().length === 0
}

export function BotCodeEditor({ value, onChange, className = "" }: BotCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const highlightRef = useRef<HTMLPreElement | null>(null)
  const [cursorPosition, setCursorPosition] = useState(value.length)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(true)
  const tokens = useMemo(() => tokenizeBotScript(value), [value])
  const suggestionState = useMemo(
    () => buildSuggestionState(value, cursorPosition),
    [cursorPosition, value]
  )

  const hasSuggestions = Boolean(suggestionState && suggestionState.items.length > 0)
  const showSuggestions = isSuggestionsOpen && hasSuggestions
  const activeSuggestion =
    suggestionState?.items[
      Math.min(selectedSuggestionIndex, Math.max((suggestionState?.items.length ?? 1) - 1, 0))
    ] ?? null

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
    setIsSuggestionsOpen(false)

    requestAnimationFrame(() => {
      const nextCursor = suggestionState.start + item.insertText.length
      textarea.focus()
      textarea.setSelectionRange(nextCursor, nextCursor)
      setCursorPosition(nextCursor)
    })
  }

  function insertAtCursor(prefix: string, suffix = "") {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    const selectionStart = textarea.selectionStart
    const selectionEnd = textarea.selectionEnd
    const nextValue = value.slice(0, selectionStart) + prefix + suffix + value.slice(selectionEnd)
    const nextCursor = selectionStart + prefix.length

    onChange(nextValue)
    setIsSuggestionsOpen(false)

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(nextCursor, nextCursor)
      setCursorPosition(nextCursor)
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
          const nextValue = event.target.value
          const nextCursor = event.target.selectionStart
          onChange(nextValue)
          setCursorPosition(nextCursor)
          setSelectedSuggestionIndex(0)
          setIsSuggestionsOpen(shouldOpenSuggestions(nextValue, nextCursor))
        }}
        onSelect={(event) => {
          setCursorPosition((event.target as HTMLTextAreaElement).selectionStart)
        }}
        onClick={() => {
          setSelectedSuggestionIndex(0)
          setIsSuggestionsOpen(true)
        }}
        onFocus={() => setIsSuggestionsOpen(true)}
        onKeyDown={(event) => {
          if (event.ctrlKey && event.key === " ") {
            event.preventDefault()
            setIsSuggestionsOpen(true)
            return
          }

          if (event.key === "Escape") {
            setIsSuggestionsOpen(false)
            setSelectedSuggestionIndex(0)
            return
          }

          if (!showSuggestions || !suggestionState || suggestionState.items.length === 0) {
            if (event.key === "Tab") {
              event.preventDefault()
              insertAtCursor("    ")
              return
            }

            if (event.key === "Enter") {
              const textarea = event.currentTarget
              const lineStart = value.lastIndexOf("\n", textarea.selectionStart - 1) + 1
              const currentLine = value.slice(lineStart, textarea.selectionStart)
              const indent = currentLine.match(/^\s*/)?.[0] ?? ""
              const trimmed = currentLine.trimEnd()
              const extraIndent = /(?:\($|\[$)/.test(trimmed) ? "    " : ""

              event.preventDefault()
              insertAtCursor(`\n${indent}${extraIndent}`)
              return
            }

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
          }
        }}
        onScroll={syncScroll}
        spellCheck={false}
        className="absolute inset-0 min-h-[38rem] w-full resize-none bg-transparent px-4 py-3 font-mono text-sm leading-6 text-transparent caret-slate-100 outline-none selection:bg-sky-500/30"
      />

      {showSuggestions && suggestionState ? (
        <div className="absolute inset-x-3 bottom-3 z-10 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur">
          <div className="grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]">
            <div className="border-b border-white/10 md:border-b-0 md:border-r md:border-white/10">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Shalter IntelliSense
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="rounded-full border border-white/10 px-2 py-0.5">Ctrl+Space</span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5">
                    {suggestionState.query || "all"}
                  </span>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto p-2">
                <div className="space-y-1">
                  {suggestionState.items.map((item, index) => {
                    const active = index === Math.min(selectedSuggestionIndex, suggestionState.items.length - 1)

                    return (
                      <button
                        key={item.label}
                        type="button"
                        className={`flex w-full items-start justify-between gap-3 rounded-xl px-2.5 py-2 text-left ${
                          active
                            ? "bg-sky-500/15 text-white ring-1 ring-sky-400/30"
                            : "text-slate-200 hover:bg-white/5"
                        }`}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          applySuggestion(item)
                        }}
                      >
                        <span className="min-w-0">
                          <span className="mb-1 flex items-center gap-2">
                            <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                              {item.kind}
                            </span>
                            <span className="truncate font-mono text-xs">{item.label}</span>
                          </span>
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
            </div>

            <div className="flex min-h-52 flex-col bg-slate-950/90 p-3">
              {activeSuggestion ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-200">
                      {activeSuggestion.kind}
                    </span>
                    <p className="truncate font-mono text-xs text-slate-200">{activeSuggestion.label}</p>
                  </div>

                  <p className="mt-3 text-sm text-slate-200">{activeSuggestion.documentation}</p>

                  {activeSuggestion.example ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">Example</p>
                      <pre className="overflow-x-auto font-mono text-xs leading-5 whitespace-pre-wrap text-slate-300">
                        {activeSuggestion.example}
                      </pre>
                    </div>
                  ) : null}

                  <div className="mt-auto flex flex-wrap gap-2 pt-3 text-[11px] text-slate-500">
                    <span>Enter or Tab to insert</span>
                    <span>Arrow keys to navigate</span>
                    <span>Esc to close</span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
