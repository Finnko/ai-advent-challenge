import type { GroupSummary } from '../domain/results'
import ModelConfigSection from './ModelConfigSection'

type ConfigTableProps = {
  summaries: GroupSummary[]
  defaultConfigId: string
}

const MODEL_ORDER = [
  'mlx-community/Qwen3-14B-4bit',
  'mlx-community/Qwen3-14B-6bit',
  'mlx-community/Qwen3-8B-4bit',
]

function orderIndex(model: string): number {
  const index = MODEL_ORDER.indexOf(model)
  return index === -1 ? MODEL_ORDER.length : index
}

export default function ConfigTable({
  summaries,
  defaultConfigId,
}: ConfigTableProps) {
  const models = [...new Set(summaries.map((summary) => summary.model))].sort(
    (a, b) => orderIndex(a) - orderIndex(b),
  )

  if (models.length === 0) {
    return <p className="demo-muted m-0 text-sm">Пока нет прогонов.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {models.map((model, index) => (
        <ModelConfigSection
          key={model}
          model={model}
          rows={summaries.filter((summary) => summary.model === model)}
          defaultConfigId={defaultConfigId}
          defaultOpen={index === 0}
        />
      ))}
    </div>
  )
}
