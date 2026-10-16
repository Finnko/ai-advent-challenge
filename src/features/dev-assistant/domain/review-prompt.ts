import type { AnswerPersona } from '@lib/rag-engine.types'

export const REVIEW_QUESTION =
  'Сделай ревью этого pull request: перечисли потенциальные баги, архитектурные проблемы и рекомендации.'

export const REVIEW_FORMAT_INSTRUCTION =
  'Верни строго JSON без markdown и пояснений: {"summary": "краткое резюме ревью (1–3 предложения)", "findings": [{"severity": "bug", "file": "src/…/file.ts", "line": 42, "message": "что не так", "suggestion": "как исправить"}]}. severity — одно из: bug (ошибка или риск), architecture (границы модулей и структура), style (соответствие CODING_STANDARDS).'

const REVIEW_SYSTEM = [
  'Ты — ревьюер pull request в проекте ai-advent-challenge (TanStack Start, TypeScript, RAG и агенты).',
  'Анализируй ТОЛЬКО изменения из диффа; фрагменты документации и кода проекта даны как контекст, чтобы судить об архитектуре и стандартах.',
  'Ищи потенциальные баги, архитектурные проблемы и давай конкретные рекомендации. Опирайся на факты из контекста и диффа, не выдумывай проблемы.',
  'Для каждой находки укажи file — путь файла ровно как в диффе, и line — номер строки в НОВОЙ версии файла, обязательно из добавленных или изменённых строк диффа.',
  'Дай не больше 8 находок — только самые значимые; message и suggestion держи короткими (1–2 предложения).',
  'Если проблем нет, верни короткое резюме и пустой массив findings.',
  REVIEW_FORMAT_INSTRUCTION,
].join(' ')

export function reviewUnavailable(reason: string): string {
  return `AI-ревью недоступно: ${reason}`
}

// Persona of the review seam: same shape as the answering one, different system
// prompt and JSON contract. `contextRescues` is true because the pull-request
// context block is exactly what the review is about — weak doc retrieval must
// never turn a review into an abstention.
export const REVIEW_PERSONA: AnswerPersona = {
  system: REVIEW_SYSTEM,
  fragmentsHeader: 'Фрагменты документации и кода проекта:',
  contextHeader: 'Контекст pull request',
  contextRescues: true,
  json: true,
  abstain: () => reviewUnavailable('недостаточно контекста.'),
}
