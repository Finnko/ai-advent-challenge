import { Badge } from '@/components/ui/Badge'
import type { ScenarioRunRow } from '../api/use-scenario-run'
import { GROUNDING_LABELS, GROUNDING_TONES } from '../data/agent-ui'
import { stepPassed } from '../domain/scenario-score'

export default function ScenarioRow({
  row,
  index,
}: {
  row: ScenarioRunRow
  index: number
}) {
  const passed = stepPassed(row.verdict)
  const grounding = row.run.grounding
  return (
    <li className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--ink)]">
          {index + 1}. {row.step.question}
        </span>
        <Badge variant={passed ? 'success' : 'danger'}>
          {passed ? 'зачёт' : 'промах'}
        </Badge>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Badge variant={row.verdict.sourcesOk ? 'success' : 'danger'}>
          источники
        </Badge>
        <Badge variant={row.verdict.groundingOk ? 'success' : 'danger'}>
          опора
        </Badge>
        <Badge variant={row.verdict.factsOk ? 'success' : 'danger'}>
          факты
        </Badge>
        {row.step.expectEarlier && (
          <Badge variant={row.verdict.orderOk ? 'success' : 'danger'}>
            порядок
          </Badge>
        )}
        {grounding && (
          <Badge variant={GROUNDING_TONES[grounding]}>
            {GROUNDING_LABELS[grounding]}
          </Badge>
        )}
      </div>
      <p className="demo-muted m-0 mt-1.5 text-xs">
        Источники:{' '}
        {(row.run.sources ?? []).map((source) => source.title).join(', ') ||
          '—'}
      </p>
      <details className="mt-1">
        <summary className="cursor-pointer text-xs text-[var(--ink-soft)]">
          Ответ
        </summary>
        <p className="m-0 mt-1 whitespace-pre-wrap text-xs text-[var(--ink-soft)]">
          {row.run.answer}
        </p>
      </details>
    </li>
  )
}
