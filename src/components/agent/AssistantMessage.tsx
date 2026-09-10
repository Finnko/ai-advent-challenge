import type { AgentRunResult } from '../../lib/agent'
import type { JudgeVerdict } from '../../lib/agent'
import { formatUsd } from '../../lib/tokens'
import TraceAccordion from './TraceAccordion'

export default function AssistantMessage({ run }: { run: AgentRunResult }) {
  const t = run.tokens
  return (
    <div className="flex flex-col gap-2">
      {run.blocked && (
        <div className="demo-alert demo-alert-danger m-0">
          <p className="m-0 text-sm">{run.answer}</p>
        </div>
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
        {run.model && <span className="demo-pill">модель: {run.model}</span>}
        <SourcePill run={run} />
        {t && t.trimmedMessages > 0 && (
          <span className="demo-pill !border-[color-mix(in_oklab,var(--warn)_40%,var(--line))] !bg-[color-mix(in_oklab,var(--warn)_12%,var(--surface))] !text-[var(--warn)]">
            история усечена: −{t.trimmedMessages} сообщ.
          </span>
        )}
      </div>
      <p className="demo-muted m-0 text-xs">
        {run.blocked ? 'отклонено полиси' : 'ок'}
        {run.usage
          ? ` · prompt ${run.usage.prompt_tokens} → completion ${run.usage.completion_tokens} ток.`
          : ''}
        {` · ${run.latencyMs} мс`}
      </p>
      {t && (
        <p className="demo-muted m-0 text-xs">
          запрос ≈{t.requestTokens} · история ≈{t.historyTokens}
          {t.historyTokensSent !== t.historyTokens
            ? ` (отправлено ≈${t.historyTokensSent})`
            : ''}{' '}
          · ответ {t.responseTokens} ток. ·{' '}
          {t.promptTokensActual > 0
            ? `в API prompt ${t.promptTokensActual} · `
            : ''}
          ~{formatUsd(t.costUsd)}
        </p>
      )}
      <TraceAccordion trace={run.trace} />
    </div>
  )
}

function VerdictPill({ verdict }: { verdict: JudgeVerdict }) {
  const failed = verdict.status === 'fail'

  return (
    <span
      className={`demo-pill ${
        failed
          ? '!border-[color-mix(in_oklab,var(--danger)_40%,var(--line))] !bg-[color-mix(in_oklab,var(--danger)_12%,var(--surface))] !text-[var(--danger)]'
          : ''
      }`}
      title={verdict.message}
    >
      {verdict.judge}: {verdict.status === 'pass' ? 'ок' : 'нарушение'}
    </span>
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
      <span
        className="demo-pill"
        title="Инструмент не вызывался — ответ собран из контекста (история/память модели)"
      >
        из контекста
      </span>
    )
  }
  if (decide.tool === 'listBookings' || decide.tool === 'listVacations') {
    return (
      <span
        className="demo-pill !border-[color-mix(in_oklab,var(--accent)_45%,var(--line))]"
        title="Ответ построен по данным из SQLite через инструмент, а не по памяти модели"
      >
        из БД
      </span>
    )
  }
  return (
    <span
      className="demo-pill"
      title={`Ответ построен по отчёту инструмента ${decide.tool}`}
    >
      из инструмента
    </span>
  )
}
