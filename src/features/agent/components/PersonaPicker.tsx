import type { OrgPerson } from '../types'
import PersonaCard from './PersonaCard'

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
