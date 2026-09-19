import { describe, expect, it } from 'vitest'
import { runActionChecks, runAnswerChecks } from '../domain/invariants/checks'
import type { InvariantRecord } from '../domain/invariants/types'
import { createIdentity } from './agent-testkit'

const records: InvariantRecord[] = [
  { id: 1, token: 'test', slug: 'meeting', category: 'business', title: 'Время', text: 'до 18:30', check: 'meeting-end-time', pinned: true },
  { id: 2, token: 'test', slug: 'vacation', category: 'business', title: 'Отпуск', text: 'до 14 дней', check: 'vacation-duration', pinned: true },
  { id: 3, token: 'test', slug: 'orion', category: 'business', title: 'Орион', text: 'нельзя', check: 'orion-employee', pinned: true },
  { id: 4, token: 'test', slug: 'sqlite', category: 'stack', title: 'SQLite', text: 'только SQLite', check: 'sqlite-only', pinned: true },
  { id: 5, token: 'test', slug: 'secrets', category: 'stack', title: 'Секреты', text: 'на сервере', check: 'server-secrets', pinned: true },
]

describe('invariant checks', () => {
  it('blocks meeting ending after 18:30 and allows the boundary', () => {
    expect(runActionChecks('bookMeetingRoom', { time: '18:00', duration: 30 }, createIdentity(), records).ok).toBe(true)
    expect(runActionChecks('bookMeetingRoom', { time: '18:01', duration: 30 }, createIdentity(), records).hits).toEqual(['INV-1'])
  })

  it('blocks vacations longer than 14 days', () => {
    expect(runActionChecks('requestVacation', { start: '2026-09-01', end: '2026-09-15' }, createIdentity(), records).ok).toBe(true)
    expect(runActionChecks('requestVacation', { start: '2026-09-01', end: '2026-09-16' }, createIdentity(), records).hits).toEqual(['INV-2'])
  })

  it('blocks Orion for employees', () => {
    expect(runActionChecks('bookMeetingRoom', { room: 'Орион' }, createIdentity(), records).hits).toEqual(['INV-3'])
    expect(runActionChecks('bookMeetingRoom', { room: 'Орион' }, { ...createIdentity(), role: 'manager' }, records).ok).toBe(true)
  })

  it('checks the destination slot of a reschedule', () => {
    expect(
      runActionChecks(
        'rescheduleBooking',
        { room: 'Ладога', date: '2026-09-11', time: '18:01', duration: 30 },
        createIdentity(),
        records,
      ).hits,
    ).toEqual(['INV-1'])
    expect(
      runActionChecks(
        'rescheduleBooking',
        { room: 'Орион', date: '2026-09-11', time: '16:00', duration: 60 },
        createIdentity(),
        records,
      ).hits,
    ).toEqual(['INV-3'])
  })

  it('scans answers without blocking compliant wording', () => {
    expect(runAnswerChecks('Используем PostgreSQL.', records).hits).toEqual(['INV-4'])
    expect(runAnswerChecks('Секрет хранится только на сервере.', records).ok).toBe(true)
    expect(runAnswerChecks('Передадим VITE_API_KEY в браузер.', records).hits).toEqual(['INV-5'])
  })

  it('does not flag a negated mention of forbidden technology', () => {
    expect(runAnswerChecks('PostgreSQL не используется: проект остаётся на SQLite.', records).ok).toBe(true)
    expect(runAnswerChecks('SQLite хранит данные локально, ключи остаются на сервере.', records).ok).toBe(true)
  })
})
