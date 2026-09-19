import type { ChatMessage } from '@/components/Chat'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'

type ConstrainedShape = {
  title?: string
  summary?: string
  keywords?: string[]
}

function parseConstrained(content: string): ConstrainedShape | null {
  const stripped = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  const jsonText = extractJsonObject(stripped)
  try {
    const parsed = JSON.parse(jsonText)
    if (parsed && typeof parsed === 'object') {
      return parsed as ConstrainedShape
    }
    return null
  } catch {
    return null
  }
}

function extractJsonObject(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    return text
  }
  return text.slice(start, end + 1)
}

export default function ConstrainedMessage({
  message,
}: {
  message: ChatMessage
}) {
  if (message.content.trim().length === 0) {
    return (
      <Alert>
        <p className="m-0 text-sm">
          Модель вернула пустой ответ — известная особенность JSON-режима.
          Попробуй ещё раз.
        </p>
      </Alert>
    )
  }

  const parsed = parseConstrained(message.content)

  if (!parsed) {
    return (
      <Alert variant="destructive">
        <p className="m-0 mb-2 text-sm font-semibold">
          Ответ — не валидный JSON
        </p>
        <pre className="m-0 whitespace-pre-wrap text-xs">{message.content}</pre>
        <p className="m-0 mt-2 text-xs opacity-80">
          Возможно, ответ обрезан лимитом токенов. Попробуй ещё раз.
        </p>
      </Alert>
    )
  }

  return (
    <div className="demo-code-block max-w-full">
      {parsed.title && (
        <p className="mb-2 text-base font-bold text-[var(--ink)]">
          {parsed.title}
        </p>
      )}
      {parsed.summary && (
        <p className="mb-3 text-sm text-[var(--ink-muted)]">
          {parsed.summary}
        </p>
      )}
      {Array.isArray(parsed.keywords) && parsed.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {parsed.keywords.map((keyword, i) => (
            <Badge key={i}>{keyword}</Badge>
          ))}
        </div>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer select-none text-xs text-[var(--ink-muted)]">
          Сырой ответ
        </summary>
        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--surface-tint)_85%,transparent)] p-2 text-xs">
          {message.content}
        </pre>
      </details>
    </div>
  )
}
