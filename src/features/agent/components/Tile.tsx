function formatTokenValue(value: number | null, estimate: boolean): string {
  if (value === null) {
    return '—'
  }
  const prefix = estimate ? '≈' : ''
  return `${prefix}${value.toLocaleString('ru-RU')}`
}

export default function Tile({
  label,
  value,
  note,
  estimate = true,
}: {
  label: string
  value: number | null
  note: string
  estimate?: boolean
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <p className="island-kicker m-0 text-[10px]">{label}</p>
      <p className="m-0 mt-1 text-xl font-extrabold tracking-tight text-[var(--ink)]">
        {formatTokenValue(value, estimate)}
        <span className="ml-1 text-xs font-semibold text-[var(--ink-muted)]">
          ток.
        </span>
      </p>
      <p className="demo-muted m-0 text-[10px]">{note}</p>
    </div>
  )
}
