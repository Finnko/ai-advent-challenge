import { Link } from '@tanstack/react-router'
import { DAYS } from '../lib/days'

const ITEM_CLASS =
  'group flex flex-col gap-0.5 rounded-lg px-3 py-2 no-underline transition-colors hover:bg-surface-tint data-[status=active]:bg-accent-soft'

export default function Sidebar() {
  return (
    <aside className="hidden w-[236px] shrink-0 border-r border-line bg-surface md:flex md:flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Программа
        </p>
        <nav className="flex flex-col gap-1">
          {DAYS.map((day) => (
            <Link key={day.path} to={day.path} className={ITEM_CLASS}>
              <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-muted transition-colors group-hover:text-ink-soft group-data-[status=active]:text-accent-strong">
                {day.label}
              </span>
              <span className="mt-0.5 block text-[13px] font-semibold text-ink group-data-[status=active]:text-accent-strong">
                {day.title}
              </span>
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-line px-4 py-3">
        <p className="m-0 text-[11px] leading-relaxed text-ink-muted">
          Учебный проект · один пользователь
        </p>
      </div>
    </aside>
  )
}
