import { Link } from '@tanstack/react-router'
import { DAYS } from '../lib/days'

export default function Sidebar() {
  return (
    <aside className="hidden w-[300px] shrink-0 border-r border-[var(--line)] bg-[color-mix(in_oklab,var(--header-bg)_75%,transparent)] md:flex md:flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <p className="island-kicker mb-3 px-2">Advent days</p>
        <nav className="flex flex-col gap-2">
          {DAYS.map((day) => (
            <Link
              key={day.path}
              to={day.path}
              className="block rounded-2xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--surface-strong)_70%,transparent)] px-4 py-3 no-underline transition-colors hover:border-[color-mix(in_oklab,var(--lagoon-deep)_35%,var(--line))] hover:bg-[var(--chip-bg)]"
              activeProps={{
                className:
                  'block rounded-2xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-3 shadow-[0_8px_24px_rgba(30,90,72,0.08)]',
              }}
            >
              <span className="block text-xs font-bold uppercase tracking-wide text-[var(--kicker)]">
                {day.label}
              </span>
              <span className="mt-0.5 block text-sm font-semibold text-[var(--sea-ink)]">
                {day.title}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  )
}
