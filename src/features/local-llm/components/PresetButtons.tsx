import type { LocalLlmPreset } from '../types'
import { Button } from '@/components/ui/Button'

type PresetButtonsProps = {
  presets: LocalLlmPreset[]
  onRun: (preset: LocalLlmPreset) => void
  disabled: boolean
}

export default function PresetButtons({
  presets,
  onRun,
  disabled,
}: PresetButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => (
        <Button
          key={preset.id}
          variant="secondary"
          onClick={() => onRun(preset)}
          disabled={disabled}
          title={preset.description}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  )
}
