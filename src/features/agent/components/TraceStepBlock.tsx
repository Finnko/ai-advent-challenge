import type { AgentTraceStep } from '../domain/agent'
import StepBody from './StepBody'

const STAGE_LABELS: Record<string, string> = {
  input: 'Input policy',
  decide: 'Decide · роутинг инструмента',
  act: 'Act · исполнение инструмента',
  finalize: 'Finalize · ответ',
  'invariant-guard': 'Invariant guard · проверка правил',
  verdicts: 'Судьи (judges)',
}

export default function TraceStepBlock({
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
