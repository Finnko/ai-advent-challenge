import type { OrgPerson } from '../../lib/api'

type PersonaPickerProps = {
  manager: OrgPerson
  employees: OrgPerson[]
  activeToken: string
  disabled?: boolean
  onPick: (token: string) => void
}

export default function PersonaPicker({
  manager,
  employees,
  activeToken,
  disabled,
  onPick,
}: PersonaPickerProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <div className="flex-1">
        <PersonaCard
          person={manager}
          active={activeToken === manager.token}
          disabled={disabled}
          onPick={onPick}
          kicker="Руководитель"
          subordinates={employees.map((e) => e.name)}
        />
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <p className="demo-muted m-0 text-xs font-bold uppercase tracking-wide">
          Линейные сотрудники
        </p>
        {employees.map((person) => (
          <PersonaCard
            key={person.token}
            person={person}
            active={activeToken === person.token}
            disabled={disabled}
            onPick={onPick}
            kicker="Сотрудник"
            compact
          />
        ))}
      </div>
    </div>
  )
}

type PersonaCardProps = {
  person: OrgPerson
  active: boolean
  disabled?: boolean
  onPick: (token: string) => void
  kicker: string
  subordinates?: string[]
  compact?: boolean
}

function PersonaCard({
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
        <span
          className={`demo-pill !py-0.5 !text-[10px] ${
            active ? '' : 'invisible'
          }`}
        >
          активна
        </span>
      </div>
      <p className={`m-0 font-bold text-[var(--ink)] ${compact ? 'text-sm' : 'text-base'}`}>
        {person.name}
      </p>
      <p className="demo-muted m-0 text-xs">{person.title}</p>
      {subordinates && subordinates.length > 0 && (
        <p className="demo-muted m-0 mt-1 text-[11px]">
          Подчинённые: {subordinates.join(', ')}
        </p>
      )}
      {!compact && (
        <p className="demo-muted m-0 mt-1 text-[10px]">мок-токен: {person.token}</p>
      )}
    </button>
  )
}
