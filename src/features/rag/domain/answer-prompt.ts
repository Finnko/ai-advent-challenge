import type { AnswerPersona } from './answer-persona'
import type { AnswerMode } from './types'

export type { PromptMessage } from './answer-persona'

const BASE_SYSTEM =
  'Ты — ассистент, который отвечает на вопросы о городах России. Отвечай по-русски, кратко и по существу.'

const BASELINE_SYSTEM = `${BASE_SYSTEM} Если не знаешь точный факт или не уверен, прямо скажи об этом и не выдумывай.`

export const ANSWER_FORMAT_INSTRUCTION =
  'Верни строго JSON без markdown и пояснений: {"answer": "краткий ответ, каждый факт со ссылкой [n]", "quotes": [{"n": 1, "text": "дословный фрагмент"}]}.'

const RAG_SYSTEM = `${BASE_SYSTEM} Ниже даны пронумерованные фрагменты документов. Опирайся ТОЛЬКО на них. ${ANSWER_FORMAT_INSTRUCTION} В quotes — только дословные подстроки из фрагментов, подтверждающие ответ, с номером n использованного фрагмента. Если ответа во фрагментах нет, верни {"answer": "в документах нет данных", "quotes": []} и не выдумывай.`

export function abstainAnswer(question: string): string {
  return `Не знаю: в предоставленных документах недостаточно данных для ответа на вопрос «${question}». Уточните, пожалуйста, город, период или аспект вопроса — и я поищу снова.`
}

const WIKI_RAG_PERSONA: AnswerPersona = {
  system: RAG_SYSTEM,
  fragmentsHeader: 'Фрагменты документов:',
  contextHeader: null,
  contextRescues: false,
  json: true,
  abstain: abstainAnswer,
}

const WIKI_BASELINE_PERSONA: AnswerPersona = {
  system: BASELINE_SYSTEM,
  fragmentsHeader: 'Фрагменты документов:',
  contextHeader: null,
  contextRescues: false,
  json: false,
  abstain: abstainAnswer,
}

export function personaFor(mode: AnswerMode): AnswerPersona {
  return mode === 'rag' ? WIKI_RAG_PERSONA : WIKI_BASELINE_PERSONA
}
