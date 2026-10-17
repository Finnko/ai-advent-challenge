import {
  approveTask,
  cancelTask,
  createTaskState,
  transitionTask,
} from '@lib/task-state/state'
import type { TaskAnalysis } from '@lib/task-state/state'
import type { TaskState } from '@lib/task-state/types'
import { CRITERIA, CRITERIA_BY_CODE } from '../data/criteria'
import { countVerdicts } from '../domain/counts'
import type {
  ProjectSummary,
  ProjectView,
  ReviewRecord,
  ReviewStatus,
} from '../types'
import { browsers, maxUploadBytes } from './config.server'
import {
  artifactsPath,
  projectPath,
  removePath,
  uploadPath,
} from './paths.server'
import {
  extractProject,
  readPackageName,
  resolveProjectRoot,
} from './project.server'
import { cancelActiveRun, launchReview } from './registry.server'
import {
  appendProgress,
  createReview,
  deleteProjectData,
  getProject,
  getProjectByKey,
  getReview,
  listProgress,
  listProjects,
  listReviews,
  updateReview,
  upsertProject,
  type ProjectRecord,
  type ReviewRecordRow,
} from './store.server'

export type StartReviewInput = {
  key: string
  zipBase64: string
  sourcePath: string | null
  resumedFrom: number | null
}

export type StartReviewResult = {
  reviewId: number
  projectKey: string
  name: string
}

function planCodes(
  resumedFrom: number | null,
  previous: ReviewRecordRow | null,
): string[] {
  const all = CRITERIA.map((criterion) => criterion.code)
  if (!resumedFrom || !previous) {
    return all
  }
  const failed = previous.results
    .filter((result) => result.status === 'fail')
    .map((result) => result.code)
  return failed.length > 0 ? failed : all
}

function planSteps(codes: string[]): string[] {
  return codes.map((code) => {
    const definition = CRITERIA_BY_CODE.get(code)
    return definition ? `${code}. ${definition.title}`.slice(0, 190) : code
  })
}

function buildPlanState(input: {
  name: string
  codes: string[]
  resumedFrom: number | null
}): TaskState {
  const analysis: TaskAnalysis = {
    title: `Проверка проекта ${input.name}`.slice(0, 80),
    stage: 'planning',
    step: input.resumedFrom
      ? `Повторная проверка: ${input.codes.length} пунктов из первичной`
      : `Первичная проверка: ${input.codes.length} критериев`,
    steps: planSteps(input.codes),
    expectedAction: {
      actor: 'user',
      description: 'Утвердить план проверки, чтобы запустить прогон',
    },
    reason: 'Проект получен на проверку',
    requiresTask: true,
  }
  return createTaskState(analysis, new Date().toISOString())
}

function toReviewRecord(
  row: ReviewRecordRow,
  projectKey: string,
): ReviewRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    projectKey,
    status: row.status,
    stage: row.stage,
    error: row.error,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
    state: row.state,
    results: row.results,
    progress: [],
    failedCodes: row.results
      .filter((result) => result.status === 'fail')
      .map((result) => result.code),
    resumedFrom: row.resumedFrom,
  }
}

async function resolveExternalRoot(input: string): Promise<string> {
  const nodePath = await import('node:path')
  const os = await import('node:os')
  const { stat } = await import('node:fs/promises')
  const expanded = input.startsWith('~/')
    ? nodePath.join(os.homedir(), input.slice(2))
    : input
  const absolute = nodePath.resolve(expanded)
  const info = await stat(absolute).catch(() => null)
  if (!info?.isDirectory()) {
    throw new Error('Путь не найден или не является папкой')
  }
  const root = await resolveProjectRoot(absolute)
  const pkg = await stat(nodePath.join(root, 'package.json')).catch(() => null)
  if (!pkg?.isFile()) {
    throw new Error('В папке проекта нет package.json')
  }
  return root
}

export async function startReview(
  input: StartReviewInput,
): Promise<StartReviewResult> {
  const key = input.key.trim()
  const source = input.sourcePath?.trim() ?? ''
  const externalRoot =
    source.length > 0 ? await resolveExternalRoot(source) : null
  const bytes = externalRoot
    ? Buffer.alloc(0)
    : Buffer.from(input.zipBase64, 'base64')
  if (!externalRoot) {
    if (bytes.length === 0) {
      throw new Error('Нужен архив или путь к распакованному проекту')
    }
    if (bytes.length > maxUploadBytes()) {
      throw new Error('Архив превышает допустимый размер')
    }
  }

  const previous = input.resumedFrom ? await getReview(input.resumedFrom) : null
  if (input.resumedFrom && !previous) {
    throw new Error('Первичная проверка не найдена')
  }
  const project = await upsertProject({ key, name: key })
  const codes = planCodes(input.resumedFrom, previous)

  const reviewId = await createReview({
    projectId: project.id,
    status: 'planning',
    stage: 'extract',
    state: buildPlanState({
      name: project.name,
      codes,
      resumedFrom: input.resumedFrom,
    }),
    browsers: browsers(),
    resumedFrom: input.resumedFrom,
    zipPath: null,
  })

  let name = project.name
  let rootPath: string | null = null
  let rootOwned = false

  if (externalRoot) {
    rootPath = externalRoot
    rootOwned = false
    name = await readPackageName(rootPath)
    await updateReview(reviewId, { rootPath, rootOwned })
  } else {
    const zipPath = await uploadPath(key, reviewId)
    const { writeFile } = await import('node:fs/promises')
    await writeFile(zipPath, bytes)
    await updateReview(reviewId, { zipPath })
    try {
      const target = await projectPath(reviewId)
      await extractProject(zipPath, target)
      rootPath = await resolveProjectRoot(target)
      rootOwned = true
      name = await readPackageName(rootPath)
      await updateReview(reviewId, { rootPath, rootOwned })
    } catch {
      rootPath = null
    }
  }

  if (name !== project.name) {
    await upsertProject({ key, name })
    await updateReview(reviewId, {
      state: buildPlanState({ name, codes, resumedFrom: input.resumedFrom }),
    })
  }

  return { reviewId, projectKey: key, name }
}

export async function approveReview(reviewId: number): Promise<number> {
  const review = await getReview(reviewId)
  if (!review) {
    throw new Error('Проверка не найдена')
  }
  if (review.status !== 'planning') {
    throw new Error('Проверка уже запущена')
  }
  const at = new Date().toISOString()
  const approved = review.state ? approveTask(review.state, at) : null
  const outcome = approved
    ? transitionTask(approved, 'execution', {
        at,
        reason: 'План утверждён пользователем',
      })
    : null
  const state =
    outcome && outcome.status === 'applied' ? outcome.state : approved
  await updateReview(reviewId, {
    status: 'running',
    stage: 'extract',
    state,
    error: null,
  })
  launchReview(reviewId)
  return reviewId
}

export async function cancelReview(reviewId: number): Promise<number> {
  const review = await getReview(reviewId)
  if (!review) {
    throw new Error('Проверка не найдена')
  }
  if (review.status !== 'running' && review.status !== 'planning') {
    throw new Error('Эту проверку нельзя прервать')
  }
  const at = new Date().toISOString()
  const state = review.state
    ? cancelTask(review.state, at, 'Проверка прервана пользователем')
    : null
  await updateReview(reviewId, {
    status: 'cancelled',
    state,
    error: 'Проверка прервана пользователем',
    finishedAt: at,
  })
  await appendProgress({
    reviewId,
    stage: review.stage ?? 'extract',
    state: 'cancelled',
    message: 'проверка прервана пользователем',
  })
  cancelActiveRun(reviewId)
  return reviewId
}

async function sourcesPresent(row: ReviewRecordRow | null): Promise<boolean> {
  if (!row?.rootPath) {
    return false
  }
  const { stat } = await import('node:fs/promises')
  try {
    return (await stat(row.rootPath)).isDirectory()
  } catch {
    return false
  }
}

async function summarize(project: ProjectRecord): Promise<ProjectSummary> {
  const reviews = await listReviews(project.id, 1)
  const last = reviews[0] ?? null
  const lastCounts = last ? countVerdicts(last.results) : null
  return {
    id: project.id,
    key: project.key,
    name: project.name,
    createdAt: project.createdAt,
    sourcesPresent: await sourcesPresent(last),
    sourcesOwned: last?.rootOwned === true,
    lastReview:
      last && lastCounts
        ? {
            id: last.id,
            status: last.status,
            createdAt: last.createdAt,
            passed: lastCounts.passed,
            failed: lastCounts.failed,
            notChecked: lastCounts.notChecked,
          }
        : null,
  }
}

export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const projects = await listProjects()
  return Promise.all(projects.map((project) => summarize(project)))
}

export async function getProjectView(key: string): Promise<ProjectView | null> {
  const project = await getProjectByKey(key)
  if (!project) {
    return null
  }
  const rows = await listReviews(project.id, 30)
  const reviews = await Promise.all(
    rows.map(async (row) => {
      const record = toReviewRecord(row, project.key)
      record.progress = await listProgress(row.id)
      return record
    }),
  )
  return { project: await summarize(project), reviews }
}

export async function getReviewStatus(
  reviewId: number,
): Promise<ReviewRecord | null> {
  const row = await getReview(reviewId)
  if (!row) {
    return null
  }
  const project = await getProject(row.projectId)
  const record = toReviewRecord(row, project?.key ?? '')
  record.progress = await listProgress(reviewId)
  return record
}

export async function cleanupProjectSources(input: {
  key: string
  dropHistory: boolean
}): Promise<void> {
  const project = await getProjectByKey(input.key)
  if (!project) {
    return
  }
  const rows = await listReviews(project.id, 500)
  for (const row of rows) {
    if (row.rootPath && row.rootOwned) {
      await removePath(row.rootPath)
    }
    await removePath(await artifactsPath(row.id))
    if (row.zipPath) {
      await removePath(row.zipPath)
    }
    await updateReview(row.id, {
      rootPath: null,
      zipPath: null,
      rootOwned: true,
    })
  }
  const nodePath = await import('node:path')
  await removePath(nodePath.dirname(await uploadPath(input.key, 0)))
  if (input.dropHistory) {
    await deleteProjectData(project.id)
  }
}

export type { ReviewStatus }
