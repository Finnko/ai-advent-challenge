export type ModelInfo = {
  label: string
  diskGb: number | null
}

const KNOWN_MODELS: Record<string, ModelInfo> = {
  'mlx-community/Qwen3-14B-4bit': { label: 'Qwen3-14B · 4-bit', diskGb: 8.3 },
  'mlx-community/Qwen3-14B-6bit': { label: 'Qwen3-14B · 6-bit', diskGb: 11.2 },
  'mlx-community/Qwen3-8B-4bit': { label: 'Qwen3-8B · 4-bit', diskGb: 4.3 },
}

export function describeModel(id: string): ModelInfo {
  const known = KNOWN_MODELS[id]
  if (known) {
    return known
  }
  return { label: id.split('/').pop() ?? id, diskGb: null }
}
