import type { LoopTraceStep } from '@lib/agent-loop/types'
import type { InvariantRecord } from '@lib/invariants/types'
import type { TaskState } from '@lib/task-state/types'
import { getRunsDb, nowIso } from './db.server'

export type FileRunMode = 'read' | 'write'

export type FileRunRecord = {
  id: number
  taskId: number | null
  goal: string
  mode: FileRunMode
  scenario: string | null
  plan: TaskState | null
  trace: LoopTraceStep[]
  diff: string | null
  answer: string
  model: string | null
  createdAt: string
}

export type FileRunInput = {
  taskId: number | null
  goal: string
  mode: FileRunMode
  scenario: string | null
  plan: TaskState | null
  trace: LoopTraceStep[]
  diff: string | null
  answer: string
  model: string | null
}

type TaskRow = { id: number; state_json: string }

type RunRow = {
  id: number
  task_id: number | null
  goal: string
  mode: string
  scenario: string | null
  plan_json: string | null
  trace_json: string
  diff: string | null
  answer: string
  model: string | null
  created_at: string
}

type InvariantRow = {
  id: number
  slug: string
  category: string
  title: string
  text: string
  check_id: string | null
  pinned: number
}

function parseJson<T>(value: string | null): T | null {
  if (!value) {
    return null
  }
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export async function createFileTask(state: TaskState): Promise<number> {
  const db = await getRunsDb()
  const now = nowIso()
  const result = db
    .prepare(
      "INSERT INTO file_tasks (state_json, status, created_at, updated_at) VALUES (?, 'open', ?, ?)",
    )
    .run(JSON.stringify(state), now, now)
  return Number(result.lastInsertRowid)
}

export async function getFileTask(id: number): Promise<TaskState | null> {
  const db = await getRunsDb()
  const row = db
    .prepare('SELECT id, state_json FROM file_tasks WHERE id = ?')
    .get(id) as TaskRow | undefined
  return row ? parseJson<TaskState>(row.state_json) : null
}

export async function latestFileTask(): Promise<{
  id: number
  state: TaskState
} | null> {
  const db = await getRunsDb()
  const row = db
    .prepare(
      "SELECT id, state_json FROM file_tasks WHERE status = 'open' ORDER BY id DESC LIMIT 1",
    )
    .get() as TaskRow | undefined
  if (!row) {
    return null
  }
  const state = parseJson<TaskState>(row.state_json)
  return state ? { id: row.id, state } : null
}

export async function saveFileTask(
  id: number,
  state: TaskState,
): Promise<void> {
  const db = await getRunsDb()
  const status =
    state.stage === 'done' || state.stage === 'cancelled' ? 'closed' : 'open'
  db.prepare(
    'UPDATE file_tasks SET state_json = ?, status = ?, updated_at = ? WHERE id = ?',
  ).run(JSON.stringify(state), status, nowIso(), id)
}

export async function saveFileRun(input: FileRunInput): Promise<number> {
  const db = await getRunsDb()
  const result = db
    .prepare(
      `INSERT INTO file_runs (task_id, goal, mode, scenario, plan_json, trace_json, diff, answer, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.taskId,
      input.goal,
      input.mode,
      input.scenario,
      input.plan ? JSON.stringify(input.plan) : null,
      JSON.stringify(input.trace),
      input.diff,
      input.answer,
      input.model,
      nowIso(),
    )
  return Number(result.lastInsertRowid)
}

function fromRunRow(row: RunRow): FileRunRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    goal: row.goal,
    mode: row.mode === 'read' ? 'read' : 'write',
    scenario: row.scenario,
    plan: parseJson<TaskState>(row.plan_json),
    trace: parseJson<LoopTraceStep[]>(row.trace_json) ?? [],
    diff: row.diff,
    answer: row.answer,
    model: row.model,
    createdAt: row.created_at,
  }
}

export async function listFileRuns(limit = 20): Promise<FileRunRecord[]> {
  const db = await getRunsDb()
  const rows = db
    .prepare(
      `SELECT id, task_id, goal, mode, scenario, plan_json, trace_json, diff, answer, model, created_at
       FROM file_runs ORDER BY id DESC LIMIT ?`,
    )
    .all(limit) as RunRow[]
  return rows.map(fromRunRow)
}

export async function getFileRun(id: number): Promise<FileRunRecord | null> {
  const db = await getRunsDb()
  const row = db
    .prepare(
      `SELECT id, task_id, goal, mode, scenario, plan_json, trace_json, diff, answer, model, created_at
       FROM file_runs WHERE id = ?`,
    )
    .get(id) as RunRow | undefined
  return row ? fromRunRow(row) : null
}

export async function listFileInvariants(): Promise<InvariantRecord[]> {
  const db = await getRunsDb()
  const rows = db
    .prepare(
      'SELECT id, slug, category, title, text, check_id, pinned FROM file_invariants ORDER BY id',
    )
    .all() as InvariantRow[]
  return rows.map((row) => ({
    id: row.id,
    token: 'file-assistant',
    slug: row.slug,
    category: row.category as InvariantRecord['category'],
    title: row.title,
    text: row.text,
    check: row.check_id,
    pinned: row.pinned === 1,
  }))
}
