import { asObject, requireText } from '@lib/functions/validation'
import { LOCAL_LLM_PRESETS } from '../data/presets'

const MAX_PROMPT_LENGTH = 4000

export function resolveRunPrompt(input: unknown): string {
  const data = asObject(input)
  if (data.presetId !== undefined && data.presetId !== null) {
    const preset = LOCAL_LLM_PRESETS.find(
      (candidate) => candidate.id === data.presetId,
    )
    if (!preset) {
      throw new Error('Неизвестный пресет')
    }
    return preset.prompt
  }
  const prompt = requireText(data.prompt, 'Промпт обязателен')
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(`Промпт длиннее ${MAX_PROMPT_LENGTH} символов`)
  }
  return prompt
}
