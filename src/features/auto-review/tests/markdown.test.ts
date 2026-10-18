import { describe, expect, it } from 'vitest'
import { formatTimestamp } from '../domain/format'
import {
  criterionMarkdown,
  findingsMarkdown,
  reviewMarkdown,
} from '../domain/markdown'
import type { CriterionResult, ProjectSummary, ReviewRecord } from '../types'

const baseResult: CriterionResult = {
  code: 'Б1',
  group: 'basic',
  section: 'Базовая проверка',
  title: 'Код соответствует техническому заданию проекта',
  rule: 'Все обязательные пункты технического задания выполнены.',
  status: 'pass',
  reason: 'Все сценарии пройдены.',
  findings: [],
  evidence: [],
  checkedAt: '2026-10-17T14:05:00',
}

function result(overrides: Partial<CriterionResult>): CriterionResult {
  return { ...baseResult, ...overrides }
}

const project: ProjectSummary = {
  id: 1,
  key: 'ivan-ivanov',
  name: 'Иван Иванов',
  createdAt: '2026-10-17T10:00:00',
  sourcesPresent: true,
  sourcesOwned: true,
  lastReview: null,
}

const review: ReviewRecord = {
  id: 12,
  projectId: 1,
  projectKey: 'ivan-ivanov',
  status: 'done',
  stage: 'report',
  error: null,
  createdAt: '2026-10-17T14:05:00',
  finishedAt: '2026-10-17T14:19:00',
  state: null,
  results: [
    baseResult,
    result({
      code: 'Б3',
      title: 'Код является кроссбраузерным',
      status: 'fail',
      reason: 'обязательные сценарии падают в Firefox',
      findings: ['следует устранить ошибки в Firefox'],
    }),
    result({
      code: 'Д2',
      group: 'advanced',
      section: 'Стиль кода, читаемость, единообразие',
      title: 'Функции-обработчики названы через handle',
      status: 'not_checked',
      reason: 'Модель не оценила критерий.',
    }),
  ],
  progress: [],
  failedCodes: ['Б3'],
  resumedFrom: null,
}

describe('criterionMarkdown', () => {
  it('пишет код, статус, причину и замечания', () => {
    const text = criterionMarkdown(review.results[1])
    expect(text).toContain('**Б3 — не пройден**')
    expect(text).toContain('Код является кроссбраузерным')
    expect(text).toContain('Причина: обязательные сценарии падают в Firefox')
    expect(text).toContain('- следует устранить ошибки в Firefox')
  })

  it('не добавляет пустой список замечаний', () => {
    const text = criterionMarkdown(review.results[0])
    expect(text).toContain('**Б1 — пройден**')
    expect(text).not.toContain('\n- ')
  })
})

describe('findingsMarkdown', () => {
  it('оставляет только проваленные пункты', () => {
    const text = findingsMarkdown(review.results)
    expect(text).toContain('### Б3 — Код является кроссбраузерным')
    expect(text).toContain('- следует устранить ошибки в Firefox')
    expect(text).not.toContain('Б1')
    expect(text).not.toContain('Д2')
  })

  it('явно сообщает об отсутствии замечаний', () => {
    expect(findingsMarkdown([review.results[0]])).toBe('Замечаний нет.')
  })

  it('подставляет причину, если замечаний нет', () => {
    const text = findingsMarkdown([
      result({ status: 'fail', reason: 'сломано', findings: [] }),
    ])
    expect(text).toContain('Причина: сломано')
  })
})

describe('reviewMarkdown', () => {
  it('собирает шапку, итоги и секции', () => {
    const text = reviewMarkdown({ project, review })
    expect(text.startsWith('# Авторевью: Иван Иванов')).toBe(true)
    expect(text).toContain('- Проверка: #12')
    expect(text).toContain(`- Дата: ${formatTimestamp(review.createdAt)}`)
    expect(text).toContain('- Итог: пройдено 1, не пройдено 1, не проверено 1')
    expect(text).toContain('## Базовая проверка')
    expect(text).toContain('## Дополнительные критерии')
    expect(text).toContain('### Б3 — не пройден')
  })

  it('помечает неполный отчёт и повторную проверку', () => {
    const text = reviewMarkdown({
      project,
      review: { ...review, status: 'cancelled', resumedFrom: 10 },
    })
    expect(text).toContain('- Статус: отменена')
    expect(text).toContain('- Повторная проверка: по #10')
    expect(text).toContain('Проверка прервана: отчёт неполный.')
  })
})
