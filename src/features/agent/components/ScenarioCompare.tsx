import type { ScenarioComparison, ScenarioTrace } from '../types'
import { formatUsd } from '../domain/tokens'
import { strategyLabel } from '../data/day10'

type ScenarioCompareProps = {
  scenario: string
  canCompare: boolean
  running: boolean
  disabled?: boolean
  result: ScenarioComparison | null
  error: string | null
  checklist: string[]
  checklistDraft: string
  onChecklistDraft: (value: string) => void
  onAddChecklist: () => void
  onRemoveChecklist: (index: number) => void
  onCompare: () => void
}

type TraceMetrics = {
  prompt: number
  response: number
  cost: number
  cacheHit: number
  cacheMiss: number
  contextMessages: number
  runs: number
}

function metricsOf(trace: ScenarioTrace): TraceMetrics {
  return trace.messages.reduce<TraceMetrics>(
    (acc, message) => {
      if (!message.run) {
        return acc
      }
      const tokens = message.run.tokens
      acc.prompt += tokens.promptTokensActual
      acc.response += tokens.responseTokens
      acc.cost += tokens.costUsd
      acc.cacheHit += tokens.cacheHitTokens
      acc.cacheMiss += tokens.cacheMissTokens
      acc.contextMessages = Math.max(acc.contextMessages, tokens.contextMessages)
      acc.runs += 1
      return acc
    },
    {
      prompt: 0,
      response: 0,
      cost: 0,
      cacheHit: 0,
      cacheMiss: 0,
      contextMessages: 0,
      runs: 0,
    },
  )
}

function finalAnswer(trace: ScenarioTrace): string {
  const assistant = [...trace.messages]
    .reverse()
    .find((message) => message.role === 'assistant')
  return assistant?.content ?? '—'
}

function hasDetail(trace: ScenarioTrace, item: string): boolean {
  const needle = item.trim().toLowerCase()
  if (needle.length === 0) {
    return false
  }
  return trace.messages.some((message) =>
    message.content.toLowerCase().includes(needle),
  )
}

export default function ScenarioCompare({
  scenario,
  canCompare,
  running,
  disabled,
  result,
  error,
  checklist,
  checklistDraft,
  onChecklistDraft,
  onAddChecklist,
  onRemoveChecklist,
  onCompare,
}: ScenarioCompareProps) {
  return (
    <section className="demo-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="demo-section-title mb-1">
            Сравнение по сценарию «{scenario}»
          </h2>
          <p className="demo-muted m-0 text-xs">
            Прогони один и тот же диалог в трёх сессиях (по одной на стратегию) —
            панель соберёт ответы, метрики и чеклист ключевых деталей.
          </p>
        </div>
        <button
          type="button"
          onClick={onCompare}
          disabled={disabled || running || !canCompare}
          className="demo-button"
        >
          {running ? 'Сравниваю…' : 'Сравнить'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {checklist.map((item, index) => (
          <span key={`${item}-${index}`} className="demo-pill">
            {item}
            <button
              type="button"
              onClick={() => onRemoveChecklist(index)}
              className="text-[var(--ink-muted)] hover:text-[var(--danger)]"
              title="Убрать деталь"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={checklistDraft}
          onChange={(event) => onChecklistDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onAddChecklist()
            }
          }}
          placeholder="Добавить ключевую деталь…"
          className="demo-input demo-input-fit w-56"
        />
        <button
          type="button"
          onClick={onAddChecklist}
          className="demo-button demo-button-secondary px-3 py-1 text-xs"
        >
          + деталь
        </button>
      </div>

      {error && (
        <div className="demo-alert demo-alert-danger mt-3">{error}</div>
      )}

      {result && result.traces.length > 0 && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {result.traces.map((trace) => (
            <TraceCard
              key={trace.sessionId}
              trace={trace}
              checklist={checklist}
            />
          ))}
        </div>
      )}

      {result && result.traces.length === 0 && (
        <p className="demo-muted mt-3 text-xs">
          Сессий с меткой «{scenario}» пока нет.
        </p>
      )}
    </section>
  )
}

function TraceCard({
  trace,
  checklist,
}: {
  trace: ScenarioTrace
  checklist: string[]
}) {
  const metrics = metricsOf(trace)
  return (
    <article className="demo-card w-[320px] shrink-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-bold text-[var(--ink)]">
          {strategyLabel(trace.strategy)}
        </h3>
        <span className="demo-pill">{metrics.runs} ходов</span>
      </div>
      <p className="demo-muted m-0 mt-1 truncate text-[11px]">{trace.title}</p>

      <dl className="m-0 mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <Metric label="prompt API" value={`${metrics.prompt}`} />
        <Metric label="ответ" value={`${metrics.response}`} />
        <Metric label="цена" value={`~${formatUsd(metrics.cost)}`} />
        <Metric label="контекст" value={`${metrics.contextMessages}`} />
        <Metric
          label="cache hit/miss"
          value={`${metrics.cacheHit}/${metrics.cacheMiss}`}
        />
        <Metric label="фактов" value={`${trace.facts.length}`} />
      </dl>

      <p className="m-0 mt-3 whitespace-pre-wrap text-xs text-[var(--ink-soft)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:6] overflow-hidden">
        {finalAnswer(trace)}
      </p>

      {checklist.length > 0 && (
        <ul className="m-0 mt-3 list-none space-y-1 p-0 text-[11px]">
          {checklist.map((item, index) => {
            const ok = hasDetail(trace, item)
            return (
              <li key={`${item}-${index}`} className="flex items-center gap-1.5">
                <span
                  className={
                    ok
                      ? 'font-bold text-[var(--positive)]'
                      : 'font-bold text-[var(--danger)]'
                  }
                >
                  {ok ? '✓' : '✗'}
                </span>
                <span className="text-[var(--ink-muted)]">{item}</span>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[var(--ink-muted)]">{label}</dt>
      <dd className="m-0 font-bold text-[var(--ink)]">{value}</dd>
    </div>
  )
}
