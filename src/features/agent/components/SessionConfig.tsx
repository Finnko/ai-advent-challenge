import type { ContextStrategyId } from '../domain/context/types'
import type { ProfileItem } from '../types'
import {
  CONTEXT_STRATEGIES,
  CONTEXT_STRATEGY_IDS,
  strategyLabel,
} from '../domain/context/registry'
import {
  WINDOW_SIZE_MAX,
  WINDOW_SIZE_MIN,
  clampWindowSize,
} from '../domain/session/config'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

const STRATEGY_CHOICES = CONTEXT_STRATEGY_IDS.map((id) => ({
  id,
  label: CONTEXT_STRATEGIES[id].label,
  description: CONTEXT_STRATEGIES[id].description,
}))

type SessionConfigProps = {
  locked: boolean
  strategy: ContextStrategyId
  windowSize: number
  memory: boolean
  taskState: boolean
  activeTaskState: boolean
  profileName: string | null
  profiles: ProfileItem[]
  selectedProfileId: number | null
  busy: boolean
  onStrategy: (id: ContextStrategyId) => void
  onWindowSize: (size: number) => void
  onMemory: (value: boolean) => void
  onTaskState: (value: boolean) => void
  onProfile: (id: number | null) => void
}

export default function SessionConfig({
  locked,
  strategy,
  windowSize,
  memory,
  taskState,
  activeTaskState,
  profileName,
  profiles,
  selectedProfileId,
  busy,
  onStrategy,
  onWindowSize,
  onMemory,
  onTaskState,
  onProfile,
}: SessionConfigProps) {
  const list = profiles ?? []
  if (locked) {
    return (
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="island-kicker m-0 text-[10px]">Конфиг сессии</p>
        <p className="demo-muted m-0 mt-1 text-xs">
          Конфиг фиксируется при создании сессии. Чтобы изменить — начни новую
          сессию.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>{strategyLabel(strategy)}</Badge>
          {strategy === 'window' && <Badge>окно {windowSize}</Badge>}
          <Badge>{memory ? 'память вкл.' : 'память выкл.'}</Badge>
          <Badge>{activeTaskState ? 'задача вкл.' : 'задача выкл.'}</Badge>
          <Badge>{profileName ?? 'профиль по умолчанию'}</Badge>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-[color-mix(in_oklab,var(--accent)_35%,var(--line))] bg-[var(--surface)] p-4">
      <p className="island-kicker m-0 text-[10px]">Конфиг новой сессии</p>
      <p className="demo-muted m-0 mt-1 text-xs">
        Выбери настройки для следующей сессии — они зафиксируются при её
        создании.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="demo-muted flex flex-col gap-1 text-[11px]">
          стратегия контекста
          <Select
            value={strategy}
            onValueChange={(value) => onStrategy(value as ContextStrategyId)}
            disabled={busy}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STRATEGY_CHOICES.map((choice) => (
                <SelectItem key={choice.id} value={choice.id}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="demo-muted flex flex-col gap-1 text-[11px]">
          профиль
          <Select
            value={
              selectedProfileId === null ? 'default' : String(selectedProfileId)
            }
            onValueChange={(value) =>
              onProfile(value === 'default' ? null : Number(value))
            }
            disabled={busy}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">По умолчанию</SelectItem>
              {list.map((profile) => (
                <SelectItem key={profile.id} value={String(profile.id)}>
                  {profile.name}
                  {profile.isDefault ? ' · по умолчанию' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        {strategy === 'window' && (
          <label className="demo-muted flex flex-col gap-1 text-[11px]">
            размер скользящего окна
            <Input
              type="number"
              min={WINDOW_SIZE_MIN}
              max={WINDOW_SIZE_MAX}
              value={windowSize}
              onChange={(event) =>
                onWindowSize(clampWindowSize(Number(event.target.value)))
              }
              disabled={busy}
              className="h-9"
            />
          </label>
        )}

        <label className="demo-muted flex items-center gap-2 self-end text-xs">
          <Checkbox
            checked={memory}
            onCheckedChange={(checked) => onMemory(checked === true)}
            disabled={busy}
          />
          слои памяти (рабочая и долговременная)
        </label>

        <label className="demo-muted flex items-center gap-2 self-end text-xs">
          <Checkbox
            checked={taskState}
            onCheckedChange={(checked) => onTaskState(checked === true)}
            disabled={busy}
          />
          состояние задачи (этап, шаг, ожидаемое действие)
        </label>
      </div>

      <p className="demo-muted m-0 mt-3 text-xs">
        {STRATEGY_CHOICES.find((choice) => choice.id === strategy)
          ?.description ?? ''}
      </p>
    </section>
  )
}
