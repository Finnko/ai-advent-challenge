import type { AnswerPersona } from '@lib/rag-engine.types'

export const JUDGE_QUESTION =
  'Проверь каждую находку ревью: оставь только те, что подтверждаются диффом и фрагментами кода проекта.'

export const JUDGE_FORMAT_INSTRUCTION =
  'Верни строго JSON без markdown и пояснений: {"verdicts": [{"id": 1, "keep": true, "reason": "кратко: чем подтверждается или почему отклонено"}]}. id — номер находки из списка. Не добавляй новых находок и не переписывай их текст; severity можно понизить, указав "severity": "bug" | "architecture" | "style".'

const JUDGE_SYSTEM = [
  'Ты — строгий судья-верификатор ревью pull request в проекте ai-advent-challenge.',
  'По каждой находке проверь утверждение по фактам: строки диффа, фрагменты кода проекта, вывод проверки типов.',
  'Если утверждение нельзя подтвердить тем, что есть в контексте — ставь keep: false и укажи в reason, чего не хватает.',
  'Отклоняй: дубликаты одной и той же проблемы; находки, чья строка не относится к добавленным или изменённым строкам диффа; утверждения о коде, которого нет в контексте; общие придирки без конкретного риска.',
  'Судья только отбирает: новых находок не придумывай, текст message и suggestion не переписывай.',
  JUDGE_FORMAT_INSTRUCTION,
].join(' ')

export const JUDGE_PERSONA: AnswerPersona = {
  system: JUDGE_SYSTEM,
  fragmentsHeader: 'Фрагменты кода и документации проекта:',
  contextHeader: 'Материалы ревью',
  contextRescues: true,
  json: true,
  abstain: () => '',
}
