import type { CallLLM, LlmMessage } from './agent'
import type { SummaryUsage } from './compression'

export type Fact = {
  key: string
  value: string
}

export type ExtractFactsResult = {
  facts: Fact[]
  usage: SummaryUsage | null
}

export type ExtractFacts = (
  previous: Fact[],
  userMessage: string,
) => Promise<ExtractFactsResult>

export const FACTS_CATEGORIES = [
  'цель',
  'ограничения',
  'предпочтения',
  'решения',
  'договорённости',
]

function normalizeKey(key: string): string {
  return key.trim().toLowerCase()
}

export function mergeFacts(previous: Fact[], incoming: Fact[]): Fact[] {
  const merged = new Map<string, Fact>()
  for (const fact of previous) {
    const key = normalizeKey(fact.key)
    if (key.length === 0 || fact.value.trim().length === 0) {
      continue
    }
    merged.set(key, { key: fact.key.trim(), value: fact.value.trim() })
  }
  for (const fact of incoming) {
    const key = normalizeKey(fact.key)
    if (key.length === 0 || fact.value.trim().length === 0) {
      continue
    }
    merged.set(key, { key: fact.key.trim(), value: fact.value.trim() })
  }
  return [...merged.values()]
}

export function formatFactsBlock(facts: Fact[]): string {
  if (facts.length === 0) {
    return ''
  }
  const lines = facts.map((fact) => `- ${fact.key}: ${fact.value}`)
  return `ФАКТЫ О ДИАЛОГЕ:\n${lines.join('\n')}`
}

export function parseFacts(content: string): Fact[] {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return []
  }
  if (Array.isArray(parsed)) {
    return parsed
      .map((entry) => coerceFact(entry))
      .filter((fact): fact is Fact => fact !== null)
  }
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    const nested = record.facts
    if (Array.isArray(nested)) {
      return nested
        .map((entry) => coerceFact(entry))
        .filter((fact): fact is Fact => fact !== null)
    }
    return Object.entries(record)
      .map(([key, value]) => coerceFact({ key, value }))
      .filter((fact): fact is Fact => fact !== null)
  }
  return []
}

function coerceFactValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

function coerceFact(entry: unknown): Fact | null {
  if (!entry || typeof entry !== 'object') {
    return null
  }
  const record = entry as Record<string, unknown>
  const key = typeof record.key === 'string' ? record.key : ''
  const value = coerceFactValue(record.value)
  if (key.trim().length === 0 || value.trim().length === 0) {
    return null
  }
  return { key: key.trim(), value: value.trim() }
}

export function buildFactsMessages(
  previous: Fact[],
  userMessage: string,
): LlmMessage[] {
  const previousJson = JSON.stringify(previous, null, 2)
  return [
    {
      role: 'system',
      content: [
        'Ты ведёшь key-value память диалога. Извлеки и обнови важные факты.',
        `Категории ключей: ${FACTS_CATEGORIES.join(', ')}.`,
        'Верни ТОЛЬКО JSON-объект {"facts": [{"key": "...", "value": "..."}]}.',
        'Сохраняй уже известные факты, обновляй изменившиеся, не дублируй ключи.',
        'Только устойчивые факты из диалога; пустые и предположительные пропускай.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        'Известные факты (JSON):',
        previousJson,
        '',
        'Новое сообщение пользователя:',
        userMessage,
      ].join('\n'),
    },
  ]
}

export function createExtractFacts(callLLM: CallLLM): ExtractFacts {
  return async (previous, userMessage) => {
    const reply = await callLLM({
      messages: buildFactsMessages(previous, userMessage),
      temperature: 0.2,
      response_format: { type: 'json_object' },
    })
    return { facts: parseFacts(reply.content), usage: reply.usage }
  }
}
