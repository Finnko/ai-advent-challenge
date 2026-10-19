import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import TypingDots from '@/components/TypingDots'
import { SUPPORT_MAX_QUESTION_CHARS } from '../domain/constants'
import type { AskResult } from '../domain/types'
import type { SupportScenario } from '../data/help'
import AnswerMarkdown from './AnswerMarkdown'

const GENERATOR_LABELS: Record<AskResult['generator'], string> = {
  cloud: 'DeepSeek',
  local: 'локальная модель',
}

function usageLabel(result: AskResult): string {
  if (!result.usage) {
    return `${result.latencyMs} мс`
  }
  return `${result.usage.prompt_tokens} + ${result.usage.completion_tokens} токенов · ${result.latencyMs} мс`
}

export default function AskPanel({
  scenarios,
  onScenario,
  question,
  onQuestion,
  onSubmit,
  pending,
  error,
  result,
}: {
  scenarios: SupportScenario[]
  onScenario: (scenario: SupportScenario) => void
  question: string
  onQuestion: (value: string) => void
  onSubmit: () => void
  pending: boolean
  error: string | null
  result: AskResult | null
}) {
  return (
    <section className="island-shell flex flex-col gap-3 p-4">
      <div className="flex flex-wrap gap-2">
        {scenarios.map((scenario) => (
          <Button
            key={scenario.id}
            variant="secondary"
            size="xs"
            onClick={() => onScenario(scenario)}
            disabled={pending}
          >
            {scenario.label}
          </Button>
        ))}
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink-soft)]">
          Вопрос
          <textarea
            className="min-h-24 resize-y rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)]"
            value={question}
            onChange={(event) => onQuestion(event.target.value)}
            maxLength={SUPPORT_MAX_QUESTION_CHARS}
            placeholder="Например: почему не работает вход в личный кабинет?"
            disabled={pending}
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="demo-muted text-[11px]">
            {question.length}/{SUPPORT_MAX_QUESTION_CHARS}
          </span>
          <Button
            type="submit"
            disabled={pending || question.trim().length === 0}
          >
            {pending ? <TypingDots /> : 'Спросить'}
          </Button>
        </div>
      </form>

      {error && (
        <p className="m-0 rounded-lg border border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {!result && !pending && (
        <p className="demo-muted m-0 text-sm">
          Ответ появится здесь тремя блоками: по документации, по вашему
          аккаунту и что делать. Сервис не является официальной поддержкой Ozon.
        </p>
      )}

      {result && (
        <article className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {GENERATOR_LABELS[result.generator]}
            </Badge>
            <span className="demo-muted text-xs">{usageLabel(result)}</span>
            {result.contextUsed && <Badge variant="accent">контекст MCP</Badge>}
            {result.abstained && <Badge variant="warn">нет в базе</Badge>}
            {result.model && (
              <span className="demo-muted font-mono text-xs">
                {result.model}
              </span>
            )}
          </div>
          <AnswerMarkdown text={result.answer} />
        </article>
      )}
    </section>
  )
}
