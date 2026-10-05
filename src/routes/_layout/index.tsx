import { createFileRoute, Link } from '@tanstack/react-router'
import { DAYS } from '@lib/days'
import { Badge } from '@/components/ui/Badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table'
import StatCard from './-index/StatCard'
import { STATS } from './-index/stats'

export const Route = createFileRoute('/_layout/')({ component: Hub })

const STATUS: Record<string, string> = Object.fromEntries(
  DAYS.map((day) => [
    day.path,
    day.path.startsWith('/agent') || day.path.startsWith('/rag')
      ? 'Демо'
      : 'Доступно',
  ]),
)

function Hub() {
  return (
    <div className="page-wrap px-4 py-8 sm:py-10">
      <header className="mb-8">
        <p className="island-kicker mb-2">AI Advent Challenge</p>
        <h1 className="demo-title">Обзор курса</h1>
        <p className="m-0 mt-2 max-w-[65ch] text-sm text-ink-muted sm:text-base">
          Семь практических шагов: от сырого вызова LLM API до агента с памятью
          и RAG с реранкингом.
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

      <section className="mt-10" aria-label="Программа курса">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="demo-section-title">Программа курса</h2>
          <Badge>{DAYS.length} модулей</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 whitespace-nowrap">№</TableHead>
              <TableHead>Модуль</TableHead>
              <TableHead className="hidden sm:table-cell">Маршрут</TableHead>
              <TableHead className="w-28 whitespace-nowrap">Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DAYS.map((day, i) => {
              const isDemo =
                day.path.startsWith('/agent') || day.path.startsWith('/rag')
              return (
                <TableRow key={day.path}>
                  <TableCell className="whitespace-nowrap tabular-nums text-ink-muted">
                    {String(i + 1).padStart(2, '0')}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={day.path}
                      className="block text-sm font-bold text-ink no-underline hover:text-accent-strong"
                    >
                      {day.title}
                    </Link>
                    <span className="block text-xs text-ink-muted">
                      {day.description}
                    </span>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap sm:table-cell">
                    <code className="text-xs">{day.path}</code>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={isDemo ? 'accent' : 'default'}>
                      {STATUS[day.path]}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <p className="demo-muted mt-3 text-xs">
          Начни с первого модуля — каждый следующий опирается на предыдущий.
        </p>
      </section>
    </div>
  )
}
