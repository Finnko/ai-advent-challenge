import { describe, expect, it } from 'vitest'
import type { InvariantRecord } from '@lib/invariants/types'
import {
  checkInvariants,
  formatInvariantReport,
} from '../domain/invariant-report'

const RECORDS: InvariantRecord[] = [
  {
    id: 1,
    token: 'file-assistant',
    slug: 'plan-paths-only',
    category: 'decision',
    title: 'Только файлы из плана',
    text: '',
    check: 'plan-paths-only',
    pinned: true,
  },
  {
    id: 2,
    token: 'file-assistant',
    slug: 'no-secrets-in-files',
    category: 'stack',
    title: 'Секреты не попадают в файлы',
    text: '',
    check: 'no-secrets-in-files',
    pinned: true,
  },
  {
    id: 3,
    token: 'file-assistant',
    slug: 'protected-paths',
    category: 'architecture',
    title: 'Защищённые пути',
    text: '',
    check: 'protected-paths',
    pinned: true,
  },
]

describe('статическая проверка инвариантов', () => {
  it('находит секреты и защищённые пути', () => {
    const result = checkInvariants({
      invariants: RECORDS,
      files: [
        { path: 'src/a.ts', content: 'const key = "sk-abcdefghijklmnop"' },
        { path: '.env', content: null },
      ],
    })

    expect(result.violations.map((violation) => violation.code)).toEqual([
      'INV-2',
      'INV-3',
    ])
    expect(result.skipped).toEqual(['INV-1 Только файлы из плана'])
    expect(formatInvariantReport(result, 2)).toContain('Найдены нарушения (2)')
  })

  it('сообщает об отсутствии нарушений', () => {
    const result = checkInvariants({
      invariants: RECORDS,
      files: [{ path: 'src/a.ts', content: 'const value = 1' }],
    })

    expect(result.violations).toEqual([])
    expect(formatInvariantReport(result, 1)).toContain('Нарушений нет')
  })
})
