import type { Stat } from './stats'

export default function StatCard({ stat }: { stat: Stat }) {
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
