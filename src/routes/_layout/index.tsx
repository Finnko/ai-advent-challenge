import { createFileRoute, Link } from '@tanstack/react-router'
import { DAYS } from '../../lib/days'

export const Route = createFileRoute('/_layout/')({ component: Hub })

const STATS = [
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

const STATUS: Record<string, string> = {}
for (let i = 0; i < DAYS.length - 1; i++) {
  STATUS[DAYS[i].path] = 'Доступно'
}
STATUS['/agent'] = 'Демо'

function StatCard({ stat }: { stat: (typeof STATS)[number] }) {
  return (
    <div className="island-shell rounded-xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
          {stat.label}
        </p>
        <span className={`h-2 w-2 shrink-0 rounded-full ${stat.dot}`} />
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--ink)]">
        {stat.value}
      </p>
      <p className={`m-0 text-sm font-medium ${stat.noteClass}`}>{stat.note}</p>
    </div>
  )
}

function Hub() {
  return (
    <div className="page-wrap px-4 py-8 sm:py-12">
      <header className="mb-7">
        <p className="island-kicker mb-1.5">AI Advent Challenge</p>
        <h1 className="demo-title">Обзор курса</h1>
        <p className="m-0 mt-1 text-sm text-[var(--ink-muted)] sm:text-base">
          Шесть практических шагов: от сырого LLM API до агента с памятью.
        </p>
      </header>

      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Статистика курса"
      >
        {STATS.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </section>

      <section className="demo-panel mt-6 rounded-2xl p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="demo-section-title">Программа курса</h2>
          <span className="demo-pill">{DAYS.length} модулей</span>
        </div>
        <div className="demo-table-shell">
          <table className="demo-table">
            <thead>
              <tr>
                <th className="w-12">№</th>
                <th>Модуль</th>
                <th>Задача</th>
                <th className="hidden sm:table-cell">Маршрут</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day, i) => {
                const isAgent = day.path === '/agent'
                return (
                  <tr key={day.path}>
                    <td className="text-[var(--ink-muted)]">
                      {String(i + 1).padStart(2, '0')}
                    </td>
                    <td className="whitespace-nowrap text-sm font-bold text-[var(--ink)]">
                      {day.label}
                    </td>
                    <td>
                      <span className="block text-sm font-semibold text-[var(--ink-soft)]">
                        {day.title}
                      </span>
                      <span className="block text-xs text-[var(--ink-muted)]">
                        {day.description}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap sm:table-cell">
                      <code className="text-xs">{day.path}</code>
                    </td>
                    <td className="whitespace-nowrap">
                      <span
                        className={
                          isAgent
                            ? 'demo-pill !border-[color-mix(in_oklab,var(--accent)_45%,var(--line))] !bg-[var(--accent-soft)] !text-[var(--accent-strong)]'
                            : 'demo-pill'
                        }
                      >
                        {STATUS[day.path]}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="demo-muted mt-4 text-xs">
          Начни с первого модуля — каждый следующий опирается на предыдущий.
        </p>
      </section>

      <section className="mt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {DAYS.map((day) => (
            <Link
              key={day.path}
              to={day.path}
              className="island-shell group block rounded-xl p-5 no-underline transition-colors hover:border-[color-mix(in_oklab,var(--accent-strong)_35%,var(--line))]"
            >
              <p className="island-kicker mb-2">{day.label}</p>
              <h2 className="mb-1 text-lg font-bold text-[var(--ink)] group-hover:text-[var(--accent-strong)]">
                {day.title}
              </h2>
              <p className="m-0 text-sm text-[var(--ink-muted)]">
                {day.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
