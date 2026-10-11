import { SWEEP_CONFIGS } from '../data/configs'
import { Checkbox } from '@/components/ui/Checkbox'

type ConfigPickerProps = {
  selected: string[]
  disabled: boolean
  onToggle: (id: string) => void
}

export default function ConfigPicker({
  selected,
  disabled,
  onToggle,
}: ConfigPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      {SWEEP_CONFIGS.map((config) => {
        const checked = selected.includes(config.id)
        return (
          <label
            key={config.id}
            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface-tint)] px-3 py-2"
          >
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={() => onToggle(config.id)}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-[var(--ink)]">
                {config.label}
              </span>
              <span className="demo-muted text-xs">
                {config.repeats > 1
                  ? `повторов: ${config.repeats}`
                  : 'один прогон'}
                {config.jsonMode ? '' : ' · без JSON-режима'}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
