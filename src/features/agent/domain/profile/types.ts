export type ProfileField =
  | 'addressing'
  | 'tone'
  | 'language'
  | 'verbosity'
  | 'format'
  | 'constraints'
  | 'instructions'

export type ProfileRecord = {
  id: number
  token: string
  name: string
  addressing: string | null
  tone: string | null
  language: string | null
  verbosity: string | null
  format: string | null
  constraints: string | null
  instructions: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export type ProfileInput = {
  name: string
  addressing?: string | null
  tone?: string | null
  language?: string | null
  verbosity?: string | null
  format?: string | null
  constraints?: string | null
  instructions?: string | null
}

export const PROFILE_NAME_MAX = 60

export const PROFILE_FIELD_MAX = 120

export const PROFILE_CONSTRAINTS_MAX = 500

export const PROFILE_INSTRUCTIONS_MAX = 1200

export const PROFILE_FIELDS: ProfileField[] = [
  'addressing',
  'tone',
  'language',
  'verbosity',
  'format',
  'constraints',
  'instructions',
]

export const PROFILE_FIELD_LABELS: Record<ProfileField, string> = {
  addressing: 'Как обращаться',
  tone: 'Тон',
  language: 'Язык',
  verbosity: 'Длина ответов',
  format: 'Формат',
  constraints: 'Ограничения',
  instructions: 'Инструкции',
}

export const PROFILE_BLOCK_TITLE = 'ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:'

export function profileFieldMax(field: ProfileField): number {
  if (field === 'instructions') {
    return PROFILE_INSTRUCTIONS_MAX
  }
  if (field === 'constraints') {
    return PROFILE_CONSTRAINTS_MAX
  }
  return PROFILE_FIELD_MAX
}
