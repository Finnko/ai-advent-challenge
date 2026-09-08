import { Link } from '@tanstack/react-router'
import { DAYS } from '../lib/days'

export default function Sidebar() {
  return (
    <aside className="hidden w-[224px] shrink-0 border-r border-[var(--line)] bg-[color-mix(in_oklab,var(--header-bg)_75%,transparent)] md:flex md:flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
        <p className="island-kicker mb-3 px-2">Explore</p>
        <nav className="flex flex-col gap-1.5">
          {DAYS.map((day) => (
            <Link
              key={day.path}
              to={day.path}
              className="block rounded-xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--surface-strong)_70%,transparent)] px-3 py-2.5 no-underline transition-colors hover:border-[color-mix(in_oklab,var(--lagoon-deep)_35%,var(--line))] hover:bg-[var(--chip-bg)]"
              activeProps={{
                className:
                  'block rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2.5 shadow-[0_8px_24px_rgba(30,90,72,0.08)]',
              }}
            >
              <span className="block text-[10px] font-bold uppercase tracking-wide text-[var(--kicker)]">
                {day.label}
              </span>
              <span className="mt-0.5 block text-[13px] font-semibold text-[var(--sea-ink)]">
                {day.title}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  )
}
