import type { InvariantInput } from './types'

export const DEFAULT_INVARIANTS: InvariantInput[] = [
  {
    slug: 'meeting-end-time',
    category: 'business',
    title: 'Встречи заканчиваются до 18:30',
    text: 'Встречи не назначаются позже 18:30.',
    check: 'meeting-end-time',
  },
  {
    slug: 'vacation-duration',
    category: 'business',
    title: 'Отпуск не длиннее 14 дней',
    text: 'Отпуск длиннее 14 дней не согласуется.',
    check: 'vacation-duration',
  },
  {
    slug: 'orion-employee',
    category: 'business',
    title: 'Орион недоступен линейным сотрудникам',
    text: 'Линейные сотрудники не бронируют переговорную «Орион».',
    check: 'orion-employee',
  },
  {
    slug: 'sqlite-only',
    category: 'stack',
    title: 'Только SQLite',
    text: 'Используется только SQLite (node:sqlite); внешние базы данных не предлагать.',
    check: 'sqlite-only',
  },
  {
    slug: 'server-secrets',
    category: 'stack',
    title: 'Секреты только на сервере',
    text: 'Секреты хранятся только на сервере; ключи и VITE_-переменные не передаются в браузер.',
    check: 'server-secrets',
  },
]
