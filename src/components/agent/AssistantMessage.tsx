import type { AgentRunResult } from '../../lib/agent'
import type { JudgeVerdict } from '../../lib/agent'
import TraceAccordion from './TraceAccordion'

export default function AssistantMessage({ run }: { run: AgentRunResult }) {
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
      </div>
      <p className="demo-muted m-0 text-xs">
        {run.blocked ? 'отклонено полиси' : 'ок'}
        {run.usage
          ? ` · prompt ${run.usage.prompt_tokens} → completion ${run.usage.completion_tokens} ток.`
          : ''}
        {` · ${run.latencyMs} мс`}
      </p>
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
