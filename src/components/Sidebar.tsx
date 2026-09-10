import { Link } from '@tanstack/react-router'
import { DAYS } from '../lib/days'

export default function Sidebar() {
  return (
    <aside className="hidden w-[224px] shrink-0 border-r border-[var(--line)] bg-[var(--surface)] md:flex md:flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <p className="island-kicker mb-3 px-3">Explore</p>
        <nav className="flex flex-col gap-0.5">
          {DAYS.map((day) => (
            <Link
              key={day.path}
              to={day.path}
              className="group relative flex flex-col gap-0.5 rounded-lg px-3 py-2 no-underline transition-colors hover:bg-[var(--surface-tint)]"
              activeProps={{
                className:
                  'group relative flex flex-col gap-0.5 rounded-lg px-3 py-2 no-underline transition-colors bg-[var(--accent-soft)] shadow-[inset_3px_0_0_var(--accent)]',
              }}
            >
              <span className="block text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)] transition-colors group-hover:text-[var(--ink-soft)]">
                {day.label}
              </span>
              <span className="mt-0.5 block text-[13px] font-semibold text-[var(--ink)]">
                {day.title}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  )
}
