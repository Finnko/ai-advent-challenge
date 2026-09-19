import { DAYS } from '@lib/days'

export type Stat = {
  label: string
  value: string
  note: string
  dot: string
  noteClass: string
}

export const STATS: Stat[] = [
  {
    label: 'Шаги курса',
    value: String(DAYS.length),
    note: 'Все модули готовы',
    dot: 'bg-[var(--accent)]',
    noteClass: 'text-[var(--positive)]',
  },
  {
    label: 'Тиры моделей',
    value: '3',
    note: 'weak · medium · strong',
    dot: 'bg-[var(--info)]',
    noteClass: 'text-[var(--info)]',
  },
  {
    label: 'Контекст модели',
    value: '1M',
    note: 'токенов у deepseek-flash',
    dot: 'bg-[var(--surface-tint)]',
    noteClass: 'text-[var(--ink-muted)]',
  },
  {
    label: 'Бюджет агента',
    value: '4 096',
    note: 'демо-лимит из 1 000 000 токенов контекста',
    dot: 'bg-[var(--positive)]',
    noteClass: 'text-[var(--ink-muted)]',
  },
]
