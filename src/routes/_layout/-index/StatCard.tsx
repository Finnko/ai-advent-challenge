import type { Stat } from './stats'

export default function StatCard({ stat }: { stat: Stat }) {
  return (
    <div className="island-shell rounded-panel p-5 sm:p-6">
      <p className="m-0 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {stat.label}
      </p>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink tabular-nums">
        {stat.value}
      </p>
      <p className={`m-0 mt-1 text-sm font-medium ${stat.noteClass}`}>
        {stat.note}
      </p>
    </div>
  )
}
