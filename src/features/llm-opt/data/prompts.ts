import type { ChatMessage } from '@lib/llm'
import { FEDERAL_DISTRICTS } from '../domain/extraction'

export type PromptVariantId = 'p0' | 'p1' | 'p2'

export type PromptVariant = {
  id: PromptVariantId
  label: string
  description: string
  system: string
  user: (context: string) => string
}

const P0_SYSTEM = 'Ты извлекаешь факты из текста. Верни ответ в формате JSON.'

const P0_USER = (context: string): string =>
  `Извлеки из текста год основания, площадь в км² и федеральный округ.\n\nТекст:\n${context}\n\nОтветь JSON.`

const P1_SCHEMA = [
  '{',
  '  "founded_year": <год основания числом>,',
  '  "area_km2": <площадь города в км² числом>,',
  `  "federal_district": <одно из: ${FEDERAL_DISTRICTS.map((d) => `"${d}"`).join(', ')}>`,
  '}',
].join('\n')

const P1_SYSTEM = [
  'Ты извлекаешь структурированные факты из русскоязычного текста о городе и возвращаешь строго JSON без markdown и пояснений.',
  'Схема ответа:',
  P1_SCHEMA,
  'Если значение не указано в тексте, поставь null. Не добавляй пояснений.',
].join('\n')

const P2_SYSTEM = [
  P1_SYSTEM,
  'Пример:',
  'Текст: «Тверь — административный центр Тверской области в Центральном федеральном округе. Основана в 1135 году. Площадь — 152,2 км².»',
  'Ответ: {"founded_year": 1135, "area_km2": 152.2, "federal_district": "Центральный"}',
].join('\n')

export const PROMPT_VARIANTS: PromptVariant[] = [
  {
    id: 'p0',
    label: 'P0 · базовый',
    description: 'Минимальная инструкция без схемы полей.',
    system: P0_SYSTEM,
    user: P0_USER,
  },
  {
    id: 'p1',
    label: 'P1 · схема',
    description:
      'Явная схема полей, единицы и список округов, запрет пояснений.',
    system: P1_SYSTEM,
    user: (context) => context,
  },
  {
    id: 'p2',
    label: 'P2 · схема + пример',
    description: 'P1 плюс один few-shot пример на другом городе.',
    system: P2_SYSTEM,
    user: (context) => context,
  },
]

export function findPrompt(id: PromptVariantId): PromptVariant {
  const variant = PROMPT_VARIANTS.find((candidate) => candidate.id === id)
  if (!variant) {
    throw new Error(`Неизвестный prompt-вариант: ${id}`)
  }
  return variant
}

export function buildPromptMessages(
  id: PromptVariantId,
  context: string,
): ChatMessage[] {
  const variant = findPrompt(id)
  return [
    { role: 'system', content: variant.system },
    { role: 'user', content: variant.user(context) },
  ]
}
