import { asObject, requireText } from '@lib/functions/validation'
import { SWEEP_CONFIGS } from '../data/configs'
import { OPT_DOC_IDS } from '../data/dataset'

export type RunExtractionInput = {
  configId: string
  docId: string
  repeat: number
}

export function resolveRunExtractionInput(input: unknown): RunExtractionInput {
  const data = asObject(input)
  const configId = requireText(data.configId, 'configId обязателен')
  if (!SWEEP_CONFIGS.some((config) => config.id === configId)) {
    throw new Error('Неизвестная конфигурация')
  }
  const docId = requireText(data.docId, 'docId обязателен')
  if (!OPT_DOC_IDS.includes(docId)) {
    throw new Error('Неизвестный документ')
  }
  const repeat =
    typeof data.repeat === 'number' &&
    Number.isInteger(data.repeat) &&
    data.repeat >= 0
      ? data.repeat
      : 0
  return { configId, docId, repeat }
}
