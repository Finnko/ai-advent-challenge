import type { TaskState } from '@lib/task-state/types'
import type {
  CriterionResult,
  ProgressRow,
  ReviewStatus,
  StageId,
  StageState,
} from '../types'
import { getDb, nowIso } from './db.server'

export type ProjectRecord = {
  id: number
  key: string
  name: string
  createdAt: string
}

export type ReviewRecordRow = {
  id: number
  projectId: number
  status: ReviewStatus
  stage: StageId | null
  state: TaskState | null
  error: string | null
  resumedFrom: number | null
  browsers: string[]
  results: CriterionResult[]
  zipPath: string | null
  rootPath: string | null
  rootOwned: boolean
  createdAt: string
  finishedAt: string | null
}

type ProjectRow = {
  id: number
  key: string
  name: string
  created_at: string
}

type ReviewRow = {
  id: number
  project_id: number
  status: string
  stage: string | null
  state_json: string | null
  error: string | null
  resumed_from: number | null
  browsers: string
  results_json: string
  zip_path: string | null
  root_path: string | null
  root_owned: number
  created_at: string
  finished_at: string | null
}

type ProgressDbRow = {
  id: number
  stage: string
  state: string
  message: string
  created_at: string
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback
  }
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function fromProjectRow(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    createdAt: row.created_at,
  }
}

function fromReviewRow(row: ReviewRow): ReviewRecordRow {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status as ReviewStatus,
    stage: (row.stage as StageId | null) ?? null,
    state: parseJson<TaskState | null>(row.state_json, null),
    error: row.error,
    resumedFrom: row.resumed_from,
    browsers: parseJson<string[]>(row.browsers, []),
    results: parseJson<CriterionResult[]>(row.results_json, []),
    zipPath: row.zip_path,
    rootPath: row.root_path,
    rootOwned: row.root_owned === 1,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  }
}

export async function upsertProject(input: {
  key: string
  name: string
}): Promise<ProjectRecord> {
  const db = await getDb()
  const now = nowIso()
  db.prepare(
    `INSERT INTO projects (key, name, created_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET name = excluded.name`,
  ).run(input.key, input.name, now)
  const row = db
    .prepare('SELECT * FROM projects WHERE key = ?')
    .get(input.key) as ProjectRow
  return fromProjectRow(row)
}

export async function getProject(id: number): Promise<ProjectRecord | null> {
  const db = await getDb()
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
    ProjectRow | undefined
  return row ? fromProjectRow(row) : null
}

export async function getProjectByKey(
  key: string,
): Promise<ProjectRecord | null> {
  const db = await getDb()
  const row = db.prepare('SELECT * FROM projects WHERE key = ?').get(key) as
    ProjectRow | undefined
  return row ? fromProjectRow(row) : null
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const db = await getDb()
  const rows = db
    .prepare('SELECT * FROM projects ORDER BY id DESC')
    .all() as ProjectRow[]
  return rows.map(fromProjectRow)
}

export async function createReview(input: {
  projectId: number
  status: ReviewStatus
  stage: StageId | null
  state: TaskState | null
  browsers: string[]
  resumedFrom: number | null
  zipPath: string | null
}): Promise<number> {
  const db = await getDb()
  const result = db
    .prepare(
      `INSERT INTO reviews (project_id, status, stage, state_json, resumed_from, browsers, zip_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.projectId,
      input.status,
      input.stage,
      input.state ? JSON.stringify(input.state) : null,
      input.resumedFrom,
      JSON.stringify(input.browsers),
      input.zipPath,
      nowIso(),
    )
  return Number(result.lastInsertRowid)
}

function serializeState(
  patch: { state?: TaskState | null },
  current: string | null,
): string | null {
  if (patch.state === undefined) {
    return current
  }
  return patch.state ? JSON.stringify(patch.state) : null
}

function serializeResults(
  patch: { results?: CriterionResult[] },
  current: string,
): string {
  if (patch.results === undefined) {
    return current
  }
  return JSON.stringify(patch.results)
}

function serializeOwned(
  patch: { rootOwned?: boolean },
  current: number,
): number {
  if (patch.rootOwned === undefined) {
    return current
  }
  return patch.rootOwned ? 1 : 0
}

export async function updateReview(
  id: number,
  patch: {
    status?: ReviewStatus
    stage?: StageId | null
    state?: TaskState | null
    error?: string | null
    results?: CriterionResult[]
    rootPath?: string | null
    rootOwned?: boolean
    zipPath?: string | null
    finishedAt?: string | null
  },
): Promise<void> {
  const db = await getDb()
  const current = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id) as
    ReviewRow | undefined
  if (!current) {
    return
  }
  db.prepare(
    `UPDATE reviews SET status = ?, stage = ?, state_json = ?, error = ?, results_json = ?, root_path = ?, root_owned = ?, zip_path = ?, finished_at = ? WHERE id = ?`,
  ).run(
    patch.status ?? current.status,
    patch.stage === undefined ? current.stage : patch.stage,
    serializeState(patch, current.state_json),
    patch.error === undefined ? current.error : patch.error,
    serializeResults(patch, current.results_json),
    patch.rootPath === undefined ? current.root_path : patch.rootPath,
    serializeOwned(patch, current.root_owned),
    patch.zipPath === undefined ? current.zip_path : patch.zipPath,
    patch.finishedAt === undefined ? current.finished_at : patch.finishedAt,
    id,
  )
}

export async function getReview(id: number): Promise<ReviewRecordRow | null> {
  const db = await getDb()
  const row = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id) as
    ReviewRow | undefined
  return row ? fromReviewRow(row) : null
}

export async function listReviews(
  projectId: number,
  limit = 20,
): Promise<ReviewRecordRow[]> {
  const db = await getDb()
  const rows = db
    .prepare(
      'SELECT * FROM reviews WHERE project_id = ? ORDER BY id DESC LIMIT ?',
    )
    .all(projectId, limit) as ReviewRow[]
  return rows.map(fromReviewRow)
}

export async function latestReview(
  projectId: number,
): Promise<ReviewRecordRow | null> {
  const reviews = await listReviews(projectId, 1)
  return reviews[0] ?? null
}

export async function appendProgress(input: {
  reviewId: number
  stage: StageId
  state: StageState
  message: string
}): Promise<ProgressRow> {
  const db = await getDb()
  const at = nowIso()
  const result = db
    .prepare(
      'INSERT INTO runs (review_id, stage, state, message, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(input.reviewId, input.stage, input.state, input.message, at)
  return {
    id: Number(result.lastInsertRowid),
    stage: input.stage,
    state: input.state,
    message: input.message,
    at,
  }
}

export async function listProgress(
  reviewId: number,
  afterId = 0,
): Promise<ProgressRow[]> {
  const db = await getDb()
  const rows = db
    .prepare(
      'SELECT id, stage, state, message, created_at FROM runs WHERE review_id = ? AND id > ? ORDER BY id',
    )
    .all(reviewId, afterId) as ProgressDbRow[]
  return rows.map((row) => ({
    id: row.id,
    stage: row.stage as StageId,
    state: row.state as StageState,
    message: row.message,
    at: row.created_at,
  }))
}

export async function deleteProjectData(projectId: number): Promise<void> {
  const db = await getDb()
  const reviews = db
    .prepare('SELECT id FROM reviews WHERE project_id = ?')
    .all(projectId) as { id: number }[]
  const deleteRuns = db.prepare('DELETE FROM runs WHERE review_id = ?')
  for (const review of reviews) {
    deleteRuns.run(review.id)
  }
  db.prepare('DELETE FROM reviews WHERE project_id = ?').run(projectId)
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId)
}
