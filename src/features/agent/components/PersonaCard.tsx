import type { OrgPerson } from '../types'
import { Badge } from '@/components/ui/Badge'

export type PersonaCardProps = {
  person: OrgPerson
  active: boolean
  disabled?: boolean
  onPick: (token: string) => void
  kicker: string
  subordinates?: string[]
  compact?: boolean
}

export default function PersonaCard({
  person,
  active,
  disabled,
  onPick,
  kicker,
  subordinates,
  compact,
}: PersonaCardProps) {
  return (
    <button
      type="button"
      onClick={() => onPick(person.token)}
      disabled={disabled}
      className={`demo-panel flex-1 border p-3 text-left transition-colors ${
        active
          ? 'border-[color-mix(in_oklab,var(--accent)_60%,var(--line))] bg-[color-mix(in_oklab,var(--accent)_14%,var(--surface-strong))]'
          : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]'
      } ${compact ? '!p-2.5' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="island-kicker m-0">{kicker}</p>
        <Badge
          variant="accent"
          className={`py-0.5 text-[10px] ${active ? '' : 'invisible'}`}
        >
          активна
        </Badge>
      </div>
      <p
        className={`m-0 font-bold text-[var(--ink)] ${compact ? 'text-sm' : 'text-base'}`}
      >
        {person.name}
      </p>
      <p className="demo-muted m-0 text-xs">{person.title}</p>
      {subordinates && subordinates.length > 0 && (
        <p className="demo-muted m-0 mt-1 text-[11px]">
          Подчинённые: {subordinates.join(', ')}
        </p>
      )}
      {!compact && (
        <p className="demo-muted m-0 mt-1 text-[10px]">
          мок-токен: {person.token}
        </p>
      )}
    </button>
  )
}
