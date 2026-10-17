import { ADVANCED_CRITERIA } from '../data/criteria'
import type { CriterionResult } from '../types'
import type { SourceFile } from './sources'
import { formatFindings } from './findings'

const MODEL_CRITERIA = ADVANCED_CRITERIA.filter(
  (criterion) => criterion.evaluation === 'model',
)

const KEYWORDS = [
  'useEffect',
  'isMounted',
  'createSlice',
  'createAction',
  'createAsyncThunk',
  'combineReducers',
  'createSelector',
  'useSelector',
  'useDispatch',
  'dispatch',
  'reducer',
  'action',
  'selector',
  'RootState',
  'AppDispatch',
  'useState',
  'const',
  'enum',
]

export const TONE_LINE =
  'Тон спокойный, но требовательный. Формулировки в стиле «следует …», «надо исправить …». Каждая находка — отдельная строка, начинается с «- ». Без вступлений, без пересказа правила, без пояснений.'

export function buildSystemPrompt(): string {
  return [
    'Ты проверяешь студенческий проект «Шесть городов» (React + Redux Toolkit) по критериям защиты.',
    'Отвечай по-русски, только JSON по заданному контракту.',
    TONE_LINE,
    'Опирайся только на приведённый код и факты. Если данных для критерия нет, ставь status «pass» не наугад: опирайся на то, что видно в коде.',
  ].join('\n')
}

function criterionChecklist(): string {
  return MODEL_CRITERIA.map(
    (criterion) =>
      `${criterion.code} (${criterion.section}) — ${criterion.title}. Правило: ${criterion.rule}`,
  ).join('\n')
}

export function scoreFile(file: SourceFile): number {
  const pathBonus = /(components|store|hooks|slices|reducers|selectors)/.test(
    file.path,
  )
    ? 4
    : 0
  const nameBonus = file.path.endsWith('package.json') ? 6 : 0
  let score = pathBonus + nameBonus
  for (const keyword of KEYWORDS) {
    if (file.content.includes(keyword)) {
      score += 1
    }
  }
  return score
}

export function packCodeContext(files: SourceFile[], budget: number): string {
  const ranked = [...files].sort((a, b) => scoreFile(b) - scoreFile(a))
  const chunks: string[] = []
  let size = 0
  for (const file of ranked) {
    const block = `\n===== ${file.path} =====\n${file.content}`
    if (size + block.length > budget && chunks.length > 0) {
      continue
    }
    chunks.push(block)
    size += block.length
    if (size >= budget) {
      break
    }
  }
  return chunks.join('\n')
}

export type PromptPair = { system: string; user: string }

export function buildJudgePrompt(
  codeContext: string,
  focusCodes: string[] | null,
): PromptPair {
  const checklist =
    focusCodes && focusCodes.length > 0
      ? MODEL_CRITERIA.filter((criterion) =>
          focusCodes.includes(criterion.code),
        )
      : MODEL_CRITERIA
  const list = checklist
    .map(
      (criterion) =>
        `${criterion.code} (${criterion.section}) — ${criterion.title}. Правило: ${criterion.rule}`,
    )
    .join('\n')
  const user = [
    'Проверь проект по критериям Д. Для каждого критерия реши, выполнен он или нет, и перечисли конкретные нарушения.',
    '',
    'Критерии:',
    list,
    '',
    'Код проекта:',
    codeContext,
    '',
    'Ответ строго в JSON:',
    '{"verdicts":[{"code":"Д3","status":"fail","reason":"одна короткая фраза","findings":["следует …"]}]}',
    'Для выполненного критерия status = "pass" и findings пустой массив.',
    'Проверяй ровно перечисленные критерии.',
  ].join('\n')
  return { system: buildSystemPrompt(), user }
}

export function buildExplanationPrompt(failed: CriterionResult[]): PromptPair {
  const blocks = failed.map((result) => {
    const header = `${result.code} — ${result.title}. Правило: ${result.rule}`
    const reason = result.reason.length > 0 ? `Итог: ${result.reason}` : ''
    const evidence =
      result.evidence.length > 0
        ? `Факты:\n${result.evidence.map((item) => `- ${item}`).join('\n')}`
        : 'Факты: нет'
    return [header, reason, evidence].join('\n')
  })
  const user = [
    'Критерии уже проверены автоматически и не пройдены. Сформулируй для каждого конкретные исправления на основе фактов.',
    '',
    blocks.join('\n\n'),
    '',
    'Ответ строго в JSON:',
    '{"verdicts":[{"code":"Б1","reason":"одна короткая фраза","findings":["следует …"]}]}',
    'Проверяй ровно перечисленные критерии. Не меняй их статус.',
  ].join('\n')
  return { system: buildSystemPrompt(), user }
}

export { formatFindings, criterionChecklist }
