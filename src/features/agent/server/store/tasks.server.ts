import type {
  TaskActor,
  TaskState,
  TaskTransition,
} from '../../domain/task/types'
import { isTaskActor, isTaskStage } from '../../domain/task/types'
import { getDb, nowIso, safeParse } from './db.server'

type TaskStateRow = {
  title: string
  stage: string
  previous_stage: string | null
  approved: number
  step: string
  steps_json: string
  step_index: number
  expected_actor: string
  expected_description: string
  history_json: string
  updated_at: string
}

function parseSteps(value: string): string[] {
  const parsed = safeParse(value)
  if (!Array.isArray(parsed)) {
    return []
  }
  return parsed.filter(
    (entry): entry is string => typeof entry === 'string' && entry.length > 0,
  )
}

function parseHistory(value: string): TaskTransition[] {
  const parsed = safeParse(value)
  if (!Array.isArray(parsed)) {
    return []
  }
  return parsed.flatMap((entry): TaskTransition[] => {
    if (!entry || typeof entry !== 'object') {
      return []
    }
    const record = entry as Record<string, unknown>
    if (!isTaskStage(record.from) || !isTaskStage(record.to)) {
      return []
    }
    return [
      {
        from: record.from,
        to: record.to,
        reason: typeof record.reason === 'string' ? record.reason : '',
        at: typeof record.at === 'string' ? record.at : '',
      },
    ]
  })
}

export async function getTaskState(
  sessionId: number,
): Promise<TaskState | null> {
  const db = await getDb()
  const row = db
    .prepare(
      'SELECT title, stage, previous_stage, approved, step, steps_json, step_index, expected_actor, expected_description, history_json, updated_at FROM task_states WHERE session_id = ?',
    )
    .get(sessionId) as TaskStateRow | undefined
  if (!row || !isTaskStage(row.stage)) {
    return null
  }
  const actor: TaskActor = isTaskActor(row.expected_actor)
    ? row.expected_actor
    : 'agent'
  const steps = parseSteps(row.steps_json)
  const stepIndex =
    steps.length > 0
      ? Math.min(Math.max(row.step_index ?? 0, 0), steps.length - 1)
      : 0
  return {
    title: row.title,
    stage: row.stage,
    previousStage: isTaskStage(row.previous_stage) ? row.previous_stage : null,
    approved: row.approved === 1,
    step: row.step,
    steps,
    stepIndex,
    expectedAction: { actor, description: row.expected_description },
    updatedAt: row.updated_at,
    history: parseHistory(row.history_json),
  }
}

export async function saveTaskState(
  sessionId: number,
  state: TaskState,
): Promise<void> {
  const db = await getDb()
  db.prepare(
    `INSERT INTO task_states (
       session_id, title, stage, previous_stage, approved, step, steps_json, step_index,
       expected_actor, expected_description, history_json, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       title = excluded.title,
       stage = excluded.stage,
       previous_stage = excluded.previous_stage,
       approved = excluded.approved,
       step = excluded.step,
       steps_json = excluded.steps_json,
       step_index = excluded.step_index,
       expected_actor = excluded.expected_actor,
       expected_description = excluded.expected_description,
       history_json = excluded.history_json,
       updated_at = excluded.updated_at`,
  ).run(
    sessionId,
    state.title,
    state.stage,
    state.previousStage,
    state.approved ? 1 : 0,
    state.step,
    JSON.stringify(state.steps ?? []),
    state.stepIndex ?? 0,
    state.expectedAction.actor,
    state.expectedAction.description,
    JSON.stringify(state.history),
    state.updatedAt || nowIso(),
  )
}
