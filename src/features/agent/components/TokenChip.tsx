import { Badge } from '@/components/ui/Badge'

export default function TokenChip({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <Badge
      title={note ? `${label}: ${value} · ${note}` : `${label}: ${value}`}
    >
      <span className="text-[var(--ink-muted)]">{label}</span>{' '}
      <span className="font-bold text-[var(--ink)]">{value}</span>
      {note && <span className="text-[var(--ink-muted)]"> · {note}</span>}
    </Badge>
  )
}
