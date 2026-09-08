import { createFileRoute, Link } from '@tanstack/react-router'
import { DAYS } from '../../lib/days'

export const Route = createFileRoute('/_layout/')({ component: Hub })

function Hub() {
  return (
    <div className="page-wrap px-4 py-10 sm:py-14">
      <section className="grid gap-4 sm:grid-cols-2">
        {DAYS.map((day) => (
          <Link
            key={day.path}
            to={day.path}
            className="island-shell group block rounded-2xl p-5 no-underline transition-colors hover:border-[color-mix(in_oklab,var(--lagoon-deep)_35%,var(--line))]"
          >
            <p className="island-kicker mb-2">{day.label}</p>
            <h2 className="mb-1 text-lg font-bold text-[var(--sea-ink)]">
              {day.title}
            </h2>
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
              {day.description}
            </p>
          </Link>
        ))}
      </section>
    </div>
  )
}
