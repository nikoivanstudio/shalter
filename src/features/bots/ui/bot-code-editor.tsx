"use client"

import { useMemo, useRef } from "react"

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

const TOKEN_PATTERN =
  /(from|import)\b|(ShalterBot)\b|(\b(?:bot)\.(?:greeting|guard|handoff|default|rule_contains|rule_regex|command|on_command|on_text|on_regex)\b)|("""[\s\S]*?"""|r?"[^"\n]*")|(#.*$)|(\b\d+\b)|(flags)\b/gm

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

export function BotCodeEditor({ value, onChange, className = "" }: BotCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const highlightRef = useRef<HTMLPreElement | null>(null)
  const tokens = useMemo(() => tokenizeBotScript(value), [value])

  function syncScroll() {
    if (!textareaRef.current || !highlightRef.current) {
      return
    }

    highlightRef.current.scrollTop = textareaRef.current.scrollTop
    highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
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
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        className="absolute inset-0 min-h-[38rem] w-full resize-none bg-transparent px-4 py-3 font-mono text-sm leading-6 text-transparent caret-slate-100 outline-none selection:bg-sky-500/30"
      />
    </div>
  )
}
