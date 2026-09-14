import type { CallLLM, LlmMessage } from '../agent'
import type { SummaryUsage } from '../compression'
import type { MemoryCandidate, MemorySnapshot } from './types'
import { isMemoryLayer } from './read'

export type ExtractMemoriesResult = {
  candidates: MemoryCandidate[]
  usage: SummaryUsage | null
}

export type ExtractMemories = (
  existing: MemorySnapshot,
  userMessage: string,
) => Promise<ExtractMemoriesResult>

const LAYER_TAXONOMY = [
  'Слои памяти:',
  '- working — данные ТЕКУЩЕЙ задачи: цель, ограничения, сроки, бюджет, договорённости, ссылки на встречи и заявки.',
  '- long-term — устойчивое между сессиями: профиль (имя, роль, должность, подчинённые), предпочтения и привычки, принятые решения и политики, переиспользуемые знания.',
  'Краткосрочная память (текущий диалог) уже хранится системой — её не извлекай.',
].join('\n')

export function parseMemoryCandidates(content: string): MemoryCandidate[] {
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
  let entries: unknown
  if (Array.isArray(parsed)) {
    entries = parsed
  } else if (parsed && typeof parsed === 'object') {
    entries = (parsed as Record<string, unknown>).memories
  } else {
    entries = null
  }
  if (!Array.isArray(entries)) {
    return []
  }
  return entries
    .map((entry) => coerceCandidate(entry))
    .filter((candidate): candidate is MemoryCandidate => candidate !== null)
}

function coerceCandidate(entry: unknown): MemoryCandidate | null {
  if (!entry || typeof entry !== 'object') {
    return null
  }
  const record = entry as Record<string, unknown>
  const key = typeof record.key === 'string' ? record.key.trim() : ''
  let value = ''
  if (typeof record.value === 'string') {
    value = record.value
  } else if (
    typeof record.value === 'number' ||
    typeof record.value === 'boolean'
  ) {
    value = String(record.value)
  }
  if (key.length === 0 || value.trim().length === 0) {
    return null
  }
  const rawLayer = record.layer
  const layer =
    typeof rawLayer === 'string' && isMemoryLayer(rawLayer)
      ? rawLayer
      : null
  return { layer, key, value: value.trim() }
}

export function buildMemoryMessages(
  existing: MemorySnapshot,
  userMessage: string,
): LlmMessage[] {
  const known = JSON.stringify(
    {
      working: existing.working.map(({ key, value }) => ({ key, value })),
      'long-term': existing.longTerm.map(({ key, value }) => ({ key, value })),
    },
    null,
    2,
  )
  return [
    {
      role: 'system',
      content: [
        'Ты ведёшь явную модель памяти агента и раскладываешь новые сведения по слоям.',
        LAYER_TAXONOMY,
        'Верни ТОЛЬКО JSON-объект {"memories": [{"layer": "working" | "long-term", "key": "...", "value": "..."}]}.',
        'Сохраняй устойчивые сведения; обновляй изменившиеся; не дублируй ключи.',
        'Если сведений для памяти нет — верни {"memories": []}.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        'Уже известная память (JSON):',
        known,
        '',
        'Новое сообщение пользователя:',
        userMessage,
      ].join('\n'),
    },
  ]
}

export function createExtractMemories(callLLM: CallLLM): ExtractMemories {
  return async (existing, userMessage) => {
    const reply = await callLLM({
      messages: buildMemoryMessages(existing, userMessage),
      temperature: 0.2,
      response_format: { type: 'json_object' },
    })
    return {
      candidates: parseMemoryCandidates(reply.content),
      usage: reply.usage,
    }
  }
}
