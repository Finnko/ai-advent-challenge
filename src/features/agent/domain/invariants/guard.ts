import type { CallLLM, LlmUsage } from '../agent'
import type { InvariantRecord } from './types'
import { invariantCode, type InvariantCode } from './types'

export type InvariantGuardInput = {
  request: string
  answer: string
  report: string
  invariants: InvariantRecord[]
}

export type InvariantGuardVerdict = {
  status: 'pass' | 'fail'
  hits: InvariantCode[]
  reason: string | null
  usage: LlmUsage | null
  latencyMs: number
}

export type InvariantGuard = (
  input: InvariantGuardInput,
) => Promise<InvariantGuardVerdict>

export function hasChecklessInvariant(records: InvariantRecord[]): boolean {
  return records.some((record) => record.check === null)
}

function parseVerdict(
  content: string,
  allowedCodes: Set<string>,
  usage: LlmUsage | null,
  latencyMs: number,
): InvariantGuardVerdict {
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  try {
    const value = JSON.parse(stripped) as {
      status?: unknown
      hits?: unknown
      reason?: unknown
    }
    const hits: InvariantCode[] = Array.isArray(value.hits)
      ? value.hits.filter(
          (hit): hit is string =>
            typeof hit === 'string' && allowedCodes.has(hit),
        ) as InvariantCode[]
      : []
    const failed = value.status === 'fail' && hits.length > 0
    return {
      status: failed ? 'fail' : 'pass',
      hits,
      reason: failed && typeof value.reason === 'string' ? value.reason : null,
      usage,
      latencyMs,
    }
  } catch {
    return { status: 'pass', hits: [], reason: null, usage, latencyMs }
  }
}

export function createInvariantGuard(callLLM: CallLLM): InvariantGuard {
  return async ({ request, answer, report, invariants }) => {
    const checkless = invariants.filter((record) => record.check === null)
    const allowedCodes = new Set(checkless.map(invariantCode))
    const reply = await callLLM({
      messages: [
        {
          role: 'system',
          content:
            'Ты проверяешь ответ корпоративного агента на пользовательские инварианты. Верни только JSON: {"status":"pass"|"fail","hits":["INV-id"],"reason":"..."}. Нарушение отмечай только если оно следует из запроса, отчёта или ответа. В hits используй только коды из списка правил.',
        },
        {
          role: 'user',
          content: [
            `Запрос пользователя:\n${request}`,
            `Ответ агента:\n${answer}`,
            `Сводка отчётов инструментов:\n${report || '(нет)'}`,
            'Правила без детерминированной проверки:',
            ...checkless.map(
              (record) => `${invariantCode(record)} — ${record.title}: ${record.text}`,
            ),
          ].join('\n\n'),
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 300,
    })
    return parseVerdict(
      reply.content,
      allowedCodes,
      reply.usage,
      reply.latencyMs,
    )
  }
}
