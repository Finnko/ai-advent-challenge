import type { LoopTraceStep } from '@lib/agent-loop/types'
import TraceStepBlock from './TraceStepBlock'

export default function TraceAccordion({ trace }: { trace: LoopTraceStep[] }) {
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
