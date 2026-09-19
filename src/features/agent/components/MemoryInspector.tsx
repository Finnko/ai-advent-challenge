import type { MemoryLayer } from '../domain/memory/types'
import type { MemoryItem } from '../types'
import ShortTermSection from './ShortTermSection'
import LayerSection from './LayerSection'

type MemoryInspectorProps = {
  working: MemoryItem[]
  longTerm: MemoryItem[]
  shortTermCount: number
  disabled?: boolean
  onForget: (scope: MemoryLayer, key: string) => void
}

export default function MemoryInspector({
  working,
  longTerm,
  shortTermCount,
  disabled,
  onForget,
}: MemoryInspectorProps) {
  return (
    <div className="flex flex-col gap-3">
      <ShortTermSection count={shortTermCount} />
      <LayerSection
        scope="working"
        entries={working}
        disabled={disabled}
        onForget={onForget}
      />
      <LayerSection
        scope="long-term"
        entries={longTerm}
        disabled={disabled}
        onForget={onForget}
      />
    </div>
  )
}
