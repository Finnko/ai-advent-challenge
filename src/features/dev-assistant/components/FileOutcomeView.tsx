import TaskStateBar from '@/components/TaskStateBar'
import TraceAccordion from '@/components/TraceAccordion'
import { Alert } from '@/components/ui/Alert'
import type { FileOutcome } from '../types'
import DiffBlock from './DiffBlock'

type Props = {
  outcome: FileOutcome
  busy: boolean
  onApprove: () => void
  onCancel: () => void
}

export default function FileOutcomeView({
  outcome,
  busy,
  onApprove,
  onCancel,
}: Props) {
  if (outcome.kind === 'read') {
    return (
      <div className="flex flex-col gap-2">
        <p className="m-0 whitespace-pre-wrap leading-relaxed">
          {outcome.answer}
        </p>
        {outcome.diff && outcome.diff.trim().length > 0 && (
          <details>
            <summary className="cursor-pointer select-none text-xs text-[var(--ink-muted)]">
              diff изменений
            </summary>
            <DiffBlock diff={outcome.diff} />
          </details>
        )}
        {outcome.trace.length > 0 && <TraceAccordion trace={outcome.trace} />}
      </div>
    )
  }

  if (outcome.kind === 'plan') {
    return (
      <div className="flex flex-col gap-2">
        <p className="m-0">
          План готов. Утвердите план кнопкой или напишите «подтверждаю» —
          ассистент выполнит шаги и проверит результат.
        </p>
        <TaskStateBar
          state={outcome.state}
          enabled
          hasSession
          busy={busy}
          onPause={() => undefined}
          onResume={() => undefined}
          onCancel={onCancel}
          onApprove={onApprove}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 whitespace-pre-wrap leading-relaxed">
        {outcome.answer}
      </p>
      {outcome.touched.length > 0 && (
        <div>
          <p className="island-kicker m-0 mb-1 text-[10px]">Изменённые файлы</p>
          <ul className="m-0 flex list-none flex-col gap-0.5 pl-0">
            {outcome.touched.map((path) => (
              <li key={path} className="font-mono text-xs">
                {path}
              </li>
            ))}
          </ul>
        </div>
      )}
      {outcome.diff.trim().length > 0 && (
        <details>
          <summary className="cursor-pointer select-none text-xs text-[var(--ink-muted)]">
            diff изменений
          </summary>
          <DiffBlock diff={outcome.diff} />
        </details>
      )}
      <TraceAccordion trace={outcome.trace} />
      {outcome.unfinished.length > 0 && (
        <Alert variant="destructive">
          Не выполнено ({outcome.unfinished.length}):{' '}
          {outcome.unfinished.join('; ')}. Файлы этих пунктов не изменены.
        </Alert>
      )}
      {outcome.notChanged && outcome.unfinished.length === 0 && (
        <p className="demo-muted m-0 text-xs">
          Файлы не изменены — ассистент не внёс правок (документация уже
          актуальна или правка не потребовалась).
        </p>
      )}
      {outcome.retried && (
        <p className="demo-muted m-0 text-xs">
          Понадобилась одна повторная попытка исполнения плана.
        </p>
      )}
    </div>
  )
}
