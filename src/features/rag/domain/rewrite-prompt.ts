import type { PromptMessage } from './answer-prompt'

export type Rewriter = (question: string) => Promise<string>

const REWRITE_SYSTEM =
  'Ты переформулируешь поисковый запрос, чтобы поиск по документам о городах России находил больше релевантных фрагментов. Сохрани смысл и все факты вопроса. Верни ТОЛЬКО JSON вида {"rewritten": "..."} без пояснений.'

export function buildRewriteMessages(question: string): PromptMessage[] {
  return [
    { role: 'system', content: REWRITE_SYSTEM },
    {
      role: 'user',
      content: `Вопрос: ${question}\n\nПереформулируй его для поиска.`,
    },
  ]
}

function stripFences(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
}

function extractJsonField(content: string): string | null {
  try {
    const parsed: unknown = JSON.parse(content)
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'rewritten' in parsed &&
      typeof (parsed as { rewritten: unknown }).rewritten === 'string'
    ) {
      const value = (parsed as { rewritten: string }).rewritten.trim()
      return value.length > 0 ? value : null
    }
    return null
  } catch {
    return null
  }
}

export function parseRewriteResponse(content: string): string | null {
  const cleaned = stripFences(content)
  const fromJson = extractJsonField(cleaned)
  if (fromJson) {
    return fromJson
  }
  return cleaned.length > 0 && cleaned.length <= 500 ? cleaned : null
}

export async function rewriteQuery(
  question: string,
  rewriter: Rewriter | null | undefined,
): Promise<string | null> {
  if (!rewriter) {
    return null
  }
  try {
    const rewritten = (await rewriter(question)).trim()
    return rewritten.length > 0 && rewritten !== question.trim()
      ? rewritten
      : null
  } catch {
    return null
  }
}
