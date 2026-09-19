import type { AgentTraceStep } from '../domain/agent'
import { Badge } from '@/components/ui/Badge'

export default function StepBody({ step }: { step: AgentTraceStep }) {
  switch (step.stage) {
    case 'input':
      return (
        <p className="demo-muted m-0 text-xs">
          {step.accepted
            ? `Сообщение принято (${step.charCount} симв.).`
            : `Сообщение отклонено (${step.charCount} симв.).`}
        </p>
      )
    case 'decide':
      return (
        <div className="flex flex-col gap-1.5">
          <p className="demo-muted m-0 text-xs">
            {step.tool
              ? `Выбран инструмент: ${step.tool}`
              : 'Инструмент не выбран — обычный вопрос.'}
          </p>
          {step.tool && Object.keys(step.args).length > 0 && (
            <pre className="demo-code-block whitespace-pre-wrap text-xs">
              {JSON.stringify(step.args, null, 2)}
            </pre>
          )}
          <details>
            <summary className="cursor-pointer select-none text-xs text-[var(--ink-muted)]">
              Сырой ответ LLM
            </summary>
            <pre className="demo-code-block mt-1 whitespace-pre-wrap text-xs">
              {step.raw}
            </pre>
          </details>
        </div>
      )
    case 'act':
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            <Badge>{step.tool}</Badge>
            {step.invariantHits?.map((hit) => (
              <Badge key={hit} variant="danger">
                {hit}
              </Badge>
            ))}
            {step.outcome.ok ? (
              <Badge variant="success">выполнено</Badge>
            ) : (
              <Badge variant="danger">отклонено</Badge>
            )}
          </div>
          {step.outcome.reference && (
            <p className="demo-muted m-0 text-xs">
              код: {step.outcome.reference}
            </p>
          )}
          <pre className="demo-code-block whitespace-pre-wrap text-xs">
            {step.outcome.text}
          </pre>
        </div>
      )
    case 'finalize':
      return (
        <pre className="demo-code-block select-text whitespace-pre-wrap text-xs">
          {step.answer}
        </pre>
      )
    case 'invariant-guard':
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant={step.verdict.status === 'fail' ? 'danger' : 'success'}
            >
              {step.verdict.status === 'fail' ? 'нарушение' : 'ок'}
            </Badge>
            {step.hits.map((hit) => (
              <Badge key={hit} variant="danger">
                {hit}
              </Badge>
            ))}
          </div>
          <p className="demo-muted m-0 text-xs">{step.verdict.message}</p>
          {step.error && (
            <p className="text-xs text-[var(--danger)]">{step.error}</p>
          )}
        </div>
      )
    case 'verdicts':
      return (
        <ul className="m-0 flex list-none flex-col gap-1 pl-0">
          {step.verdicts.map((v) => (
            <li key={v.judge} className="text-xs">
              <span className="font-semibold text-[var(--ink)]">
                {v.judge}:
              </span>{' '}
              <span
                className={
                  v.status === 'fail' ? 'text-[var(--danger)]' : 'demo-muted'
                }
              >
                {v.status === 'fail' ? 'нарушение — ' : 'ок — '}
              </span>
              <span className="demo-muted">{v.message}</span>
            </li>
          ))}
        </ul>
      )
  }
}
