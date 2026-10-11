import { FIELD_IDS, FIELD_LABELS, type FieldId } from '../domain/extraction'
import type { ContextMode } from './configs'
import { OPT_DOCS, type OptDoc } from './dataset'
import { PROMPT_VARIANTS, type PromptVariant } from './prompts'

export type TaskProfile = {
  id: string
  label: string
  description: string
  fields: FieldId[]
  fieldLabels: Record<FieldId, string>
  docs: OptDoc[]
  prompts: PromptVariant[]
  contextFor: (doc: OptDoc, mode: ContextMode) => string
}

export const TASK_PROFILE: TaskProfile = {
  id: 'city-facts',
  label: 'Извлечение фактов о городе',
  description:
    'Из русскоязычного текста о городе модель собирает строгий JSON с годом основания, площадью и федеральным округом.',
  fields: FIELD_IDS,
  fieldLabels: FIELD_LABELS,
  docs: OPT_DOCS,
  prompts: PROMPT_VARIANTS,
  contextFor: (doc, mode) => (mode === 'extended' ? doc.extended : doc.core),
}
