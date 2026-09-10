import type { AgentTraceStep } from '../../lib/agent'

const STAGE_LABELS: Record<string, string> = {
  input: 'Input policy',
  decide: 'Decide · роутинг инструмента',
  act: 'Act · исполнение инструмента',
  finalize: 'Finalize · ответ',
  verdicts: 'Судьи (judges)',
}

export default function TraceAccordion({ trace }: { trace: AgentTraceStep[] }) {
  return (
    <details className="mt-1">
      <summary className="cursor-pointer select-none text-xs text-[var(--ink-muted)]">
        Как агент думал и действовал ({trace.length} шагов)
      </summary>
      <div className="mt-2 flex flex-col gap-3">
        {trace.map((step, i) => (
          <TraceStepBlock key={i} index={i} step={step} />
        ))}
      </div>
    </details>
  )
}

function TraceStepBlock({
  index,
  step,
}: {
  index: number
  step: AgentTraceStep
}) {
  const label = STAGE_LABELS[step.stage] ?? step.stage

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
      <p className="island-kicker mb-1.5 text-[10px]">
        {index + 1}. {label}
      </p>
      <StepBody step={step} />
    </div>
  )
}

function StepBody({ step }: { step: AgentTraceStep }) {
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
            <span className="demo-pill">{step.tool}</span>
            {step.outcome.ok ? (
              <span className="demo-pill">выполнено</span>
            ) : (
              <span className="demo-pill">отклонено</span>
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
