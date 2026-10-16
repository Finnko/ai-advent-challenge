import { looksLikeFilePath } from './file-paths'

const PATH_LIKE = /\b(?:src|docs|md|dist|scripts|app)\/[\w./-]+/u

const FILE_IMPERATIVES = [
  'создай',
  'создать',
  'измени',
  'изменить',
  'поправь',
  'правь',
  'исправь',
  'добавь',
  'дополни',
  'допиши',
  'добавить',
  'обнови',
  'обновить',
  'удали',
  'удалить',
  'замени',
  'заменить',
  'переименуй',
  'перенеси',
  'сгенерируй',
  'напиши файл',
  'запиши',
  'отредактируй',
]

const FILE_LOOKUPS = [
  'в каком файле',
  'где используется',
  'где определен',
  'найди',
  'поищи',
  'прочитай',
  'покажи файл',
  'список файлов',
  'структура проекта',
  'дерево файлов',
]

const REPO_STATE_HINTS = [
  'дифф',
  'diff',
  'что изменилось',
  'что поменялось',
  'что изменено',
  'список изменений',
  'изменённые файлы',
  'измененные файлы',
  'changed files',
  'git status',
  'git diff',
  'незакоммичен',
  'состояние репозитория',
]

const INVARIANT_CHECK_HINTS = [
  'инвариант',
  'соответствие правил',
  'правилам проекта',
  'нарушени',
  'проверь файлы',
  'проверь что файлы',
]

const DOC_HINTS = ['документ', 'доки', 'docs', 'readme', 'adr']

const DOC_SYNC_HINTS = ['обнов', 'синхрон', 'соответств', 'приведи в']

export function looksLikeRepoStateGoal(text: string): boolean {
  const lower = text.toLowerCase()
  return REPO_STATE_HINTS.some((hint) => lower.includes(hint))
}

export function looksLikeInvariantCheckGoal(text: string): boolean {
  const lower = text.toLowerCase()
  return INVARIANT_CHECK_HINTS.some((hint) => lower.includes(hint))
}

export function looksLikeWriteGoal(text: string): boolean {
  const lower = text.toLowerCase()
  return FILE_IMPERATIVES.some((hint) => lower.includes(hint))
}

export function looksLikeDocSyncGoal(text: string): boolean {
  const lower = text.toLowerCase()
  if (!DOC_HINTS.some((hint) => lower.includes(hint))) {
    return false
  }
  return (
    DOC_SYNC_HINTS.some((hint) => lower.includes(hint)) ||
    looksLikeWriteGoal(text)
  )
}

export function looksLikeFileTask(text: string): boolean {
  const lower = text.toLowerCase()
  if (looksLikeFilePath(text) || PATH_LIKE.test(text)) {
    return true
  }
  if (
    FILE_IMPERATIVES.some((hint) => lower.includes(hint)) ||
    FILE_LOOKUPS.some((hint) => lower.includes(hint))
  ) {
    return true
  }
  if (looksLikeRepoStateGoal(text) || looksLikeInvariantCheckGoal(text)) {
    return true
  }
  return /^\s*\//.test(text)
}
