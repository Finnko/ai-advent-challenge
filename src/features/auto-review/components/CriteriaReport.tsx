import { useState } from 'react'

import { cn } from '@lib/utils'
import { CRITERION_GROUP_LABELS } from '../data/criteria'
import type { CriterionGroup } from '../data/criteria'
import { countVerdicts } from '../domain/counts'
import type { CriterionResult } from '../types'
import CriterionCard from './CriterionCard'

type Filter = 'all' | 'failed' | 'not_checked'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'failed', label: 'Провалы' },
  { id: 'not_checked', label: 'Не проверено' },
]

const GROUPS: CriterionGroup[] = ['basic', 'advanced']

export default function CriteriaReport({
  results,
}: {
  results: CriterionResult[]
}) {
  const [filter, setFilter] = useState<Filter>('all')

  if (results.length === 0) {
    return (
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
        <p className="m-0 text-sm text-[var(--ink-muted)]">
          Отчёт появится после проверки.
        </p>
      </section>
    )
  }

  const counts = countVerdicts(results)
  const visible = results.filter((result) => {
    if (filter === 'failed') {
      return result.status === 'fail'
    }
    if (filter === 'not_checked') {
      return result.status === 'not_checked'
    }
    return true
  })

  const filters = FILTERS.filter((item) => {
    if (item.id === 'failed') {
      return counts.failed > 0
    }
    if (item.id === 'not_checked') {
      return counts.notChecked > 0
    }
    return true
  })

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-e2">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
        <div>
          <h2 className="m-0 text-base font-bold leading-none text-[var(--ink)]">
            Отчёт по критериям
          </h2>
          <p className="m-0 mt-1 text-[11px] text-[var(--ink-muted)]">
            Иконка рядом с пунктом копирует его в Markdown.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                filter === item.id
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink-soft)]',
              )}
            >
              {item.label}
              {item.id === 'failed' && <span>{counts.failed}</span>}
              {item.id === 'not_checked' && <span>{counts.notChecked}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {visible.length === 0 && (
          <p className="m-0 text-sm text-[var(--ink-muted)]">
            Нет пунктов с выбранным статусом.
          </p>
        )}
        {GROUPS.map((group) => {
          const groupItems = visible.filter((result) => result.group === group)
          if (groupItems.length === 0) {
            return null
          }
          const sections = [...new Set(groupItems.map((item) => item.section))]
          return (
            <div key={group} className="flex flex-col gap-2">
              <h3 className="m-0 text-sm font-bold text-[var(--ink)]">
                {CRITERION_GROUP_LABELS[group]}
              </h3>
              <ul className="m-0 list-none divide-y divide-[var(--line)] overflow-hidden rounded-lg border border-[var(--line)] p-0">
                {sections.map((section) => {
                  const items = groupItems.filter(
                    (result) => result.section === section,
                  )
                  return (
                    <li key={section} className="list-none">
                      {section !== CRITERION_GROUP_LABELS[group] && (
                        <p className="m-0 bg-[var(--surface-tint)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ink-muted)]">
                          {section}
                        </p>
                      )}
                      <ul className="m-0 list-none divide-y divide-[var(--line)] p-0">
                        {items.map((result) => (
                          <CriterionCard key={result.code} result={result} />
                        ))}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
