export default function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint?: string
}) {
  return (
    <span className="text-[var(--ink-muted)]" title={hint}>
      {label}{' '}
      <span className="font-bold text-[var(--ink)]">
        {value.toLocaleString('ru-RU')}
      </span>
    </span>
  )
}
