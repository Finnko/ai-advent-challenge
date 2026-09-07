import { ROLE_PRESETS } from '../../lib/day6'
import type { RoleId } from '../../lib/day6'

type RolePickerProps = {
  activeId: RoleId
  disabled?: boolean
  onPick: (id: RoleId) => void
}

export default function RolePicker({
  activeId,
  disabled,
  onPick,
}: RolePickerProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {ROLE_PRESETS.map((role) => {
        const active = role.id === activeId
        return (
          <button
            key={role.id}
            type="button"
            onClick={() => onPick(role.id)}
            disabled={disabled}
            className={`demo-panel flex-1 border p-4 text-left transition-colors ${
              active
                ? 'border-[color-mix(in_oklab,var(--lagoon)_60%,var(--line))] bg-[color-mix(in_oklab,var(--lagoon)_14%,var(--surface-strong))]'
                : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--lagoon)]'
            }`}
          >
            <p className="island-kicker mb-1">{role.label}</p>
            <p className="m-0 text-sm font-bold text-[var(--sea-ink)]">
              {role.name}
            </p>
            <p className="demo-muted m-0 mt-1 text-xs">{role.description}</p>
            <p className="demo-muted m-0 mt-1 text-[10px]">
              мок-токен: {role.token}
            </p>
          </button>
        )
      })}
    </div>
  )
}
