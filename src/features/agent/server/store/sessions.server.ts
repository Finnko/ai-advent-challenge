import type { ContextStrategyId } from '../../domain/context/types'
import {
  resolveSessionConfig,
  sessionConfigInput,
} from '../../domain/session/config'
import type { SessionConfigInput } from '../../domain/session/config'
import { getDb, nowIso } from './db.server'
import { getDefaultProfileId } from './profiles.server'

export type SessionRow = {
  id: number
  token: string
  title: string
  strategy: ContextStrategyId
  scenario: string | null
  active_branch_id: number | null
  memoryEnabled: boolean
  profileId: number | null
  windowSize: number
  taskStateEnabled: boolean
  invariantSetId: number | null
  created_at: string
}

export type SessionListItem = {
  id: number
  title: string
  strategy: ContextStrategyId
  scenario: string | null
  memoryEnabled: boolean
  profileId: number | null
  profileName: string | null
  windowSize: number
  taskStateEnabled: boolean
  invariantSetId: number | null
  createdAt: string
  lastMessage: string
  messageCount: number
}

export async function createSession(
  token: string,
  title: string,
  input: Partial<SessionConfigInput> = {},
): Promise<number> {
  const db = await getDb()
  const full = sessionConfigInput(input)
  const defaultProfileId =
    full.profileId === undefined ? await getDefaultProfileId(token) : null
  const config = resolveSessionConfig(full, defaultProfileId)
  const result = db
    .prepare(
      'INSERT INTO sessions (token, title, strategy, scenario, memory_enabled, profile_id, window_size, task_state_enabled, invariant_set_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      token,
      title,
      config.strategy,
      config.scenario,
      config.memoryEnabled ? 1 : 0,
      config.profileId,
      config.windowSize,
      config.taskStateEnabled ? 1 : 0,
      config.invariantSetId,
      nowIso(),
    )
  const sessionId = Number(result.lastInsertRowid)
  const branch = db
    .prepare(
      'INSERT INTO branches (session_id, parent_branch_id, fork_message_id, title, created_at) VALUES (?, NULL, NULL, ?, ?)',
    )
    .run(sessionId, 'main', nowIso())
  db.prepare('UPDATE sessions SET active_branch_id = ? WHERE id = ?').run(
    Number(branch.lastInsertRowid),
    sessionId,
  )
  return sessionId
}

export async function updateSessionTitleIfDefault(
  sessionId: number,
  title: string,
): Promise<void> {
  const trimmed = title.trim()
  if (trimmed.length === 0) {
    return
  }
  const db = await getDb()
  db.prepare(
    "UPDATE sessions SET title = ? WHERE id = ? AND (title = '' OR title = 'Новая сессия')",
  ).run(trimmed.slice(0, 80), sessionId)
}

export async function getSession(
  sessionId: number,
): Promise<SessionRow | null> {
  const db = await getDb()
  const row = db
    .prepare(
      'SELECT id, token, title, strategy, scenario, active_branch_id, memory_enabled, profile_id, window_size, task_state_enabled, invariant_set_id, created_at FROM sessions WHERE id = ?',
    )
    .get(sessionId) as
    | {
        id: number
        token: string
        title: string
        strategy: string
        scenario: string | null
        active_branch_id: number | null
        memory_enabled: number
        profile_id: number | null
        window_size: number
        task_state_enabled: number
        invariant_set_id: number | null
        created_at: string
      }
    | undefined
  if (!row) {
    return null
  }
  return {
    id: Number(row.id),
    token: row.token,
    title: row.title,
    strategy: row.strategy as ContextStrategyId,
    scenario: row.scenario,
    active_branch_id:
      row.active_branch_id === null ? null : Number(row.active_branch_id),
    memoryEnabled: Number(row.memory_enabled) === 1,
    profileId: row.profile_id === null ? null : Number(row.profile_id),
    windowSize: Number(row.window_size),
    taskStateEnabled: Number(row.task_state_enabled) === 1,
    invariantSetId:
      row.invariant_set_id === null ? null : Number(row.invariant_set_id),
    created_at: row.created_at,
  }
}

export async function deleteSession(sessionId: number): Promise<void> {
  const db = await getDb()
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId)
    db.prepare('DELETE FROM branches WHERE session_id = ?').run(sessionId)
    db.prepare('DELETE FROM session_facts WHERE session_id = ?').run(sessionId)
    db.prepare('DELETE FROM session_summaries WHERE session_id = ?').run(
      sessionId,
    )
    db.prepare('DELETE FROM working_memory WHERE session_id = ?').run(sessionId)
    db.prepare('DELETE FROM task_states WHERE session_id = ?').run(sessionId)
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export async function listSessions(token: string): Promise<SessionListItem[]> {
  const db = await getDb()
  const rows = db
    .prepare(
      `SELECT
        s.id AS id,
        s.title AS title,
        s.strategy AS strategy,
        s.scenario AS scenario,
        s.memory_enabled AS memory_enabled,
        s.profile_id AS profile_id,
        p.name AS profile_name,
        s.window_size AS window_size,
        s.task_state_enabled AS task_state_enabled,
        s.invariant_set_id AS invariant_set_id,
        s.created_at AS created_at,
        (SELECT m.content FROM messages m WHERE m.session_id = s.id AND m.branch_id = s.active_branch_id AND m.role != 'task' ORDER BY m.id DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id AND m.branch_id = s.active_branch_id AND m.role != 'task') AS message_count
      FROM sessions s
      LEFT JOIN profiles p ON p.id = s.profile_id
      WHERE s.token = ?
      ORDER BY s.id DESC`,
    )
    .all(token) as Array<{
    id: number
    title: string
    strategy: string
    scenario: string | null
    memory_enabled: number
    profile_id: number | null
    profile_name: string | null
    window_size: number
    task_state_enabled: number
    invariant_set_id: number | null
    created_at: string
    last_message: string | null
    message_count: number
  }>
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    strategy: row.strategy as ContextStrategyId,
    scenario: row.scenario,
    memoryEnabled: Number(row.memory_enabled) === 1,
    profileId: row.profile_id === null ? null : Number(row.profile_id),
    profileName: row.profile_name,
    windowSize: Number(row.window_size),
    taskStateEnabled: Number(row.task_state_enabled) === 1,
    invariantSetId:
      row.invariant_set_id === null ? null : Number(row.invariant_set_id),
    createdAt: row.created_at,
    lastMessage: row.last_message ?? '',
    messageCount: Number(row.message_count),
  }))
}
