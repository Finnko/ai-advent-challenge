import type { AgentRunResult } from '../domain/agent'
import { Badge } from '@/components/ui/Badge'

export default function SourcePill({ run }: { run: AgentRunResult }) {
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
