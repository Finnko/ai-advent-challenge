import type { ProfileItem } from '../types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

type ProfileListProps = {
  profiles: ProfileItem[]
  activeId: number | null
  disabled?: boolean
  onSelect: (id: number) => void
  onCreate: () => void
  onDelete: (id: number) => void
  onSetDefault: (id: number) => void
}

export default function ProfileList({
  profiles,
  activeId,
  disabled,
  onSelect,
  onCreate,
  onDelete,
  onSetDefault,
}: ProfileListProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="island-kicker m-0 text-[10px]">Профили</p>
        <Button variant="secondary" size="xs" onClick={onCreate} disabled={disabled}>
          + новый
        </Button>
      </div>

      {profiles.length === 0 ? (
        <p className="demo-muted m-0 text-xs">
          Профилей пока нет. Создай первый — он станет профилем по умолчанию.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {profiles.map((profile) => {
            const isActive = profile.id === activeId
            return (
              <li
                key={profile.id}
                className={`rounded-lg border p-2 ${
                  isActive
                    ? 'border-[color-mix(in_oklab,var(--accent)_55%,var(--line))] bg-[var(--accent-soft)]'
                    : 'border-[var(--line)] bg-[var(--surface)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(profile.id)}
                  disabled={disabled}
                  className="flex w-full items-center justify-between gap-2 bg-transparent text-left"
                >
                  <span className="truncate text-xs font-bold text-[var(--ink)]">
                    {profile.name}
                  </span>
                  {profile.isDefault && <Badge>по умолчанию</Badge>}
                </button>
                <div className="mt-1 flex items-center gap-1.5">
                  {!profile.isDefault && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => onSetDefault(profile.id)}
                      disabled={disabled}
                    >
                      сделать основным
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onDelete(profile.id)}
                    disabled={disabled}
                  >
                    удалить
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
