import type { AgentRunResult } from '../domain/agent'
import type { JudgeVerdict } from '../domain/agent'
import { formatUsd } from '../domain/tokens'
import TraceAccordion from './TraceAccordion'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'

export default function AssistantMessage({ run }: { run: AgentRunResult }) {
  const t = run.tokens
  return (
    <div className="flex flex-col gap-2">
      {run.blocked && (
        <Alert variant="destructive" className="m-0">
          <p className="m-0 text-sm">{run.answer}</p>
        </Alert>
      )}
      {!run.blocked && (
        <div className="demo-code-block select-text whitespace-pre-wrap text-sm">
          {run.answer}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {run.verdicts.map((verdict) => (
          <VerdictPill key={verdict.judge} verdict={verdict} />
        ))}
        {run.model && <Badge>модель: {run.model}</Badge>}
        <SourcePill run={run} />
        {t && run.contextNote?.kind === 'summary' && t.contextMessages > 0 && (
          <Badge variant="accent">
            сжато {t.contextMessages} сообщ. в сводку
          </Badge>
        )}
        {run.contextNote?.kind === 'facts' && (
          <Badge variant="accent">фактов: {run.contextNote.messages}</Badge>
        )}
        {run.contextNote?.kind === 'window' && (
          <Badge variant="warn">
            отброшено {run.contextNote.messages} сообщ.
          </Badge>
        )}
        {run.contextNote?.kind === 'branch' && (
          <Badge>ветка: {run.contextNote.text}</Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <TokenChip label="запрос" value={`≈${t.requestTokens}`} />
        <TokenChip
          label="история"
          value={`≈${t.historyTokens}`}
          note={
            t.historyTokensSent !== t.historyTokens
              ? `отправлено ≈${t.historyTokensSent}`
              : undefined
          }
        />
        <TokenChip label="ответ" value={`${t.responseTokens}`} />
        {t.contextTokens > 0 && (
          <TokenChip label="контекст" value={`≈${t.contextTokens}`} />
        )}
        {t.promptTokensActual > 0 && (
          <TokenChip
            label="prompt API"
            value={`${t.promptTokensActual}`}
            note={
              t.cacheHitTokens > 0 || t.cacheMissTokens > 0
                ? `кеш ${t.cacheHitTokens} / miss ${t.cacheMissTokens}`
                : undefined
            }
          />
        )}
        <TokenChip
          label="цена"
          value={`~${formatUsd(t.costUsd)}`}
          note="с учётом кеша"
        />
      </div>
      <p className="demo-muted m-0 text-xs">
        {run.blocked ? 'отклонено полиси' : 'ок'} · {run.latencyMs} мс
      </p>
      <TraceAccordion trace={run.trace} />
    </div>
  )
}

function TokenChip({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <Badge
      title={note ? `${label}: ${value} · ${note}` : `${label}: ${value}`}
    >
      <span className="text-[var(--ink-muted)]">{label}</span>{' '}
      <span className="font-bold text-[var(--ink)]">{value}</span>
      {note && <span className="text-[var(--ink-muted)]"> · {note}</span>}
    </Badge>
  )
}

function VerdictPill({ verdict }: { verdict: JudgeVerdict }) {
  const failed = verdict.status === 'fail'

  return (
    <Badge
      variant={failed ? 'danger' : 'default'}
      title={verdict.message}
    >
      {verdict.judge}: {verdict.status === 'pass' ? 'ок' : 'нарушение'}
    </Badge>
  )
}

function SourcePill({ run }: { run: AgentRunResult }) {
  const decide = run.trace.find(
    (
      step,
    ): step is Extract<typeof step, { stage: 'decide'; tool: string | null }> =>
      step.stage === 'decide' && step.tool !== null,
  )
  if (!decide) {
    return (
      <Badge title="Инструмент не вызывался — ответ собран из контекста (история/память модели)">
        из контекста
      </Badge>
    )
  }
  if (decide.tool === 'listBookings' || decide.tool === 'listVacations') {
    return (
      <Badge
        variant="accent"
        title="Ответ построен по данным из SQLite через инструмент, а не по памяти модели"
      >
        из БД
      </Badge>
    )
  }
  return (
    <Badge title={`Ответ построен по отчёту инструмента ${decide.tool}`}>
      из инструмента
    </Badge>
  )
}
