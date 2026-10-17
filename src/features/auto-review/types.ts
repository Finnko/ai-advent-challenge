import type { CriterionGroup } from './data/criteria'
import type { TaskState } from '@lib/task-state/types'

export type CriterionStatus = 'pass' | 'fail' | 'not_checked'

export type CriterionResult = {
  code: string
  group: CriterionGroup
  section: string
  title: string
  rule: string
  status: CriterionStatus
  reason: string
  findings: string[]
  evidence: string[]
  checkedAt: string
}

export type StageId =
  'extract' | 'install' | 'serve' | 'tests' | 'static' | 'judge' | 'report'

export type StageState = 'pending' | 'active' | 'done' | 'failed' | 'cancelled'

export type ProgressRow = {
  id: number
  stage: StageId
  state: StageState
  message: string
  at: string
}

export type ReviewStatus =
  'planning' | 'running' | 'done' | 'failed' | 'cancelled'

export type ReviewRecord = {
  id: number
  projectId: number
  projectKey: string
  status: ReviewStatus
  stage: StageId | null
  error: string | null
  createdAt: string
  finishedAt: string | null
  state: TaskState | null
  results: CriterionResult[]
  progress: ProgressRow[]
  failedCodes: string[]
  resumedFrom: number | null
}

export type ProjectSummary = {
  id: number
  key: string
  name: string
  createdAt: string
  sourcesPresent: boolean
  sourcesOwned: boolean
  lastReview: {
    id: number
    status: ReviewStatus
    createdAt: string
    passed: number
    failed: number
    notChecked: number
  } | null
}

export type ProjectView = {
  project: ProjectSummary
  reviews: ReviewRecord[]
}

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  planning: 'план проверки',
  running: 'проверка идёт',
  done: 'проверка завершена',
  failed: 'ошибка проверки',
  cancelled: 'отменена',
}

export const CRITERION_STATUS_LABELS: Record<CriterionStatus, string> = {
  pass: 'пройден',
  fail: 'не пройден',
  not_checked: 'не проверен',
}

export const STAGE_LABELS: Record<StageId, string> = {
  extract: 'Распаковка проекта',
  install: 'Установка зависимостей',
  serve: 'Запуск приложения',
  tests: 'Прогон Playwright',
  static: 'Статические проверки',
  judge: 'Оценка критериев моделью',
  report: 'Сборка отчёта',
}

export const STAGE_ORDER: StageId[] = [
  'extract',
  'install',
  'serve',
  'tests',
  'static',
  'judge',
  'report',
]
