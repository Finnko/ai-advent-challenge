import { useState } from 'react'
import { buildAnswerMessages } from '../domain/answer-prompt'
import { parseCitations } from '../domain/answer-eval'
import { MODE_LABELS, VERDICT_LABELS } from '../data/rag-ui'
import type { AnswerResult } from '../types'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const VERDICT_VARIANT: Record<string, BadgeVariant> = {
  correct: 'success',
  partial: 'warn',
  wrong: 'danger',
  ungrounded: 'danger',
}

function usageLabel(result: AnswerResult): string {
  if (!result.usage) {
    return `${result.latencyMs} мс`
  }
  return `${result.usage.prompt_tokens} + ${result.usage.completion_tokens} токенов · ${result.latencyMs} мс`
}

export default function AnswerCard({
  title,
  result,
}: {
  title?: string
  result: AnswerResult
}) {
  const [showPrompt, setShowPrompt] = useState(false)
  const citations = parseCitations(result.answer)
  const messages = showPrompt
    ? buildAnswerMessages({
        question: result.query,
        mode: result.mode,
        chunks: result.sources.map((source) => source.chunk),
      })
    : []

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{title ?? MODE_LABELS[result.mode]}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {result.verdict && (
            <Badge variant={VERDICT_VARIANT[result.verdict] ?? 'default'}>
              {VERDICT_LABELS[result.verdict]}
            </Badge>
          )}
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setShowPrompt((value) => !value)}
          >
            {showPrompt ? 'Скрыть промпт' : 'Промпт'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="mt-3 flex flex-col gap-3">
        <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">
          {result.answer.trim().length > 0 ? result.answer : '— пустой ответ —'}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="demo-muted text-xs">{usageLabel(result)}</span>
          {citations.length > 0 && (
            <span className="demo-muted text-xs">
              ссылки: {citations.map((n) => `[${n}]`).join(' ')}
            </span>
          )}
        </div>

        {result.sources.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="demo-muted text-xs">Найденные фрагменты:</span>
            <div className="flex flex-col gap-1">
              {result.sources.map((source, index) => (
                <div
                  key={source.chunk.chunkId}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-xs"
                >
                  <Badge variant="accent">[{index + 1}]</Badge>
                  <Badge>score {source.score.toFixed(3)}</Badge>
                  <span className="font-semibold text-[var(--ink)]">
                    {source.chunk.title}
                  </span>
                  {source.chunk.section && (
                    <span className="demo-muted">раздел: {source.chunk.section}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {showPrompt && (
          <div className="flex flex-col gap-2">
            {messages.map((message) => (
              <div key={message.role} className="flex flex-col gap-1">
                <Badge variant="outline">{message.role}</Badge>
                <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-[var(--surface-tint)] p-2 text-[11px] leading-relaxed text-[var(--ink-soft)]">
                  {message.content}
                </pre>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
