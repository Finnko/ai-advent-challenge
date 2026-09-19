import type { AgentRunResult } from '../../domain/agent'
import type { ContextStrategyId } from '../../domain/context/types'
import type { Fact } from '../../domain/facts'
import type { MemoryEntry, MemoryLayer } from '../../domain/memory/types'
import type { TaskEvent } from '../../domain/task/types'
import {
  resolveSessionConfig,
  sessionConfigInput,
} from '../../domain/session/config'
import type { SessionConfigInput } from '../../domain/session/config'
import { getDb, nowIso, safeParse } from './db.server'
import { getDefaultProfileId } from './profiles.server'

export type PersonRow = {
  id: number
  token: string
  name: string
  role: 'employee' | 'manager'
  title: string
  manager_token: string | null
}

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

export type BranchRow = {
  id: number
  session_id: number
  parent_branch_id: number | null
  fork_message_id: number | null
  title: string
  created_at: string
}

export type MessageRow = {
  id: number
  session_id: number
  role: 'user' | 'assistant' | 'task'
  content: string
  run_json: string | null
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

export type StoredMessage = {
  id: number
  role: 'user' | 'assistant' | 'task'
  content: string
  run: AgentRunResult | null
  taskEvent?: TaskEvent | null
}

export type SessionSummaryRow = {
  summary: string
  throughMessageId: number
}

export type BranchDetail = {
  id: number
  sessionId: number
  parentBranchId: number | null
  forkMessageId: number | null
  title: string
  createdAt: string
  isActive: boolean
  messageCount: number
}

export async function listPeople(): Promise<PersonRow[]> {
  const db = await getDb()
  return db
    .prepare(
      'SELECT id, token, name, role, title, manager_token FROM people ORDER BY id',
    )
    .all() as PersonRow[]
}

export async function getPersonByToken(
  token: string,
): Promise<PersonRow | null> {
  const db = await getDb()
  const row = db
    .prepare(
      'SELECT id, token, name, role, title, manager_token FROM people WHERE token = ?',
    )
    .get(token) as PersonRow | undefined
  return row ?? null
}

export async function listSubordinates(token: string): Promise<PersonRow[]> {
  const db = await getDb()
  return db
    .prepare(
      'SELECT id, token, name, role, title, manager_token FROM people WHERE manager_token = ? ORDER BY id',
    )
    .all(token) as PersonRow[]
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

export async function getSession(sessionId: number): Promise<SessionRow | null> {
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

export async function listBranches(sessionId: number): Promise<BranchRow[]> {
  const db = await getDb()
  const rows = db
    .prepare(
      'SELECT id, session_id, parent_branch_id, fork_message_id, title, created_at FROM branches WHERE session_id = ? ORDER BY id',
    )
    .all(sessionId) as Array<{
    id: number
    session_id: number
    parent_branch_id: number | null
    fork_message_id: number | null
    title: string
    created_at: string
  }>
  return rows.map((row) => ({
    id: Number(row.id),
    session_id: Number(row.session_id),
    parent_branch_id:
      row.parent_branch_id === null ? null : Number(row.parent_branch_id),
    fork_message_id:
      row.fork_message_id === null ? null : Number(row.fork_message_id),
    title: row.title,
    created_at: row.created_at,
  }))
}

export async function getActiveBranch(
  sessionId: number,
): Promise<BranchRow | null> {
  const session = await getSession(sessionId)
  if (!session || session.active_branch_id === null) {
    return null
  }
  const branches = await listBranches(sessionId)
  return branches.find((branch) => branch.id === session.active_branch_id) ?? null
}

export async function countMessagesByBranch(
  sessionId: number,
): Promise<Map<number, number>> {
  const db = await getDb()
  const rows = db
    .prepare(
      'SELECT branch_id, COUNT(*) AS count FROM messages WHERE session_id = ? GROUP BY branch_id',
    )
    .all(sessionId) as Array<{ branch_id: number | null; count: number }>
  const counts = new Map<number, number>()
  for (const row of rows) {
    if (row.branch_id !== null) {
      counts.set(Number(row.branch_id), Number(row.count))
    }
  }
  return counts
}

export async function listBranchesDetailed(
  sessionId: number,
): Promise<BranchDetail[]> {
  const session = await getSession(sessionId)
  const branches = await listBranches(sessionId)
  const counts = await countMessagesByBranch(sessionId)
  return branches.map((branch) => ({
    id: branch.id,
    sessionId: branch.session_id,
    parentBranchId: branch.parent_branch_id,
    forkMessageId: branch.fork_message_id,
    title: branch.title,
    createdAt: branch.created_at,
    isActive: branch.id === session?.active_branch_id,
    messageCount: counts.get(branch.id) ?? 0,
  }))
}

export async function setActiveBranch(
  sessionId: number,
  branchId: number,
): Promise<void> {
  const db = await getDb()
  const owned = db
    .prepare('SELECT 1 AS ok FROM branches WHERE id = ? AND session_id = ?')
    .get(branchId, sessionId)
  if (!owned) {
    throw new Error('Ветка не принадлежит сессии')
  }
  db.prepare('UPDATE sessions SET active_branch_id = ? WHERE id = ?').run(
    branchId,
    sessionId,
  )
}

async function branchIdForMessage(
  sessionId: number,
  messageId: number,
): Promise<number | null> {
  const db = await getDb()
  const row = db
    .prepare('SELECT branch_id FROM messages WHERE id = ? AND session_id = ?')
    .get(messageId, sessionId) as { branch_id: number | null } | undefined
  if (!row || row.branch_id === null) {
    return null
  }
  return Number(row.branch_id)
}

async function resolveSourceBranchId(
  sessionId: number,
  fromMessageId: number | null,
  sourceBranchId: number | null,
): Promise<number | null> {
  if (sourceBranchId !== null) {
    return sourceBranchId
  }
  if (fromMessageId === null) {
    return (await getActiveBranch(sessionId))?.id ?? null
  }
  return branchIdForMessage(sessionId, fromMessageId)
}

export async function createBranch(
  sessionId: number,
  fromMessageId: number | null,
  title: string,
  sourceBranchId: number | null = null,
): Promise<number> {
  const db = await getDb()
  const sourceId = await resolveSourceBranchId(
    sessionId,
    fromMessageId,
    sourceBranchId,
  )
  const result = db
    .prepare(
      'INSERT INTO branches (session_id, parent_branch_id, fork_message_id, title, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(sessionId, sourceId, fromMessageId, title, nowIso())
  const branchId = Number(result.lastInsertRowid)
  if (sourceId !== null) {
    const filter = fromMessageId === null ? '' : 'AND id <= ?'
    const params: Array<number> =
      fromMessageId === null
        ? [branchId, sourceId]
        : [branchId, sourceId, fromMessageId]
    db.prepare(
      `INSERT INTO messages (session_id, branch_id, role, content, run_json, created_at)
       SELECT session_id, ?, role, content, run_json, created_at
       FROM messages WHERE branch_id = ? ${filter} ORDER BY id`,
    ).run(...params)
  }
  db.prepare('UPDATE sessions SET active_branch_id = ? WHERE id = ?').run(
    branchId,
    sessionId,
  )
  return branchId
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

export async function loadMessages(
  sessionId: number,
): Promise<StoredMessage[]> {
  const db = await getDb()
  const session = await getSession(sessionId)
  const branchId = session?.active_branch_id ?? null
  const rows = (
    branchId === null
      ? db
          .prepare(
            'SELECT id, role, content, run_json FROM messages WHERE session_id = ? ORDER BY id',
          )
          .all(sessionId)
      : db
          .prepare(
            'SELECT id, role, content, run_json FROM messages WHERE session_id = ? AND branch_id = ? ORDER BY id',
          )
          .all(sessionId, branchId)
  ) as Array<{
    id: number
    role: string
    content: string
    run_json: string | null
  }>
  return rows.map((row): StoredMessage => {
    const id = Number(row.id)
    if (row.role === 'task') {
      return {
        id,
        role: 'task',
        content: '',
        run: null,
        taskEvent: row.run_json
          ? (safeParse(row.run_json) as TaskEvent)
          : null,
      }
    }
    const role = row.role === 'assistant' ? 'assistant' : 'user'
    return {
      id,
      role,
      content: row.content,
      run: row.run_json ? (safeParse(row.run_json) as AgentRunResult) : null,
      taskEvent: null,
    }
  })
}

export async function getSessionSummary(
  sessionId: number,
): Promise<SessionSummaryRow | null> {
  const db = await getDb()
  const row = db
    .prepare(
      'SELECT summary, through_message_id FROM session_summaries WHERE session_id = ?',
    )
    .get(sessionId) as
    { summary: string; through_message_id: number } | undefined
  if (!row) {
    return null
  }
  return {
    summary: row.summary,
    throughMessageId: Number(row.through_message_id),
  }
}

export async function upsertSessionSummary(
  sessionId: number,
  summary: string,
  throughMessageId: number,
): Promise<void> {
  const db = await getDb()
  db.prepare(
    `INSERT INTO session_summaries (session_id, summary, through_message_id, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       summary = excluded.summary,
       through_message_id = excluded.through_message_id,
       updated_at = excluded.updated_at`,
  ).run(sessionId, summary, throughMessageId, nowIso())
}

export async function appendMessage(
  sessionId: number,
  role: 'user' | 'assistant' | 'task',
  content: string,
  runJson?: unknown,
): Promise<void> {
  const db = await getDb()
  const session = await getSession(sessionId)
  db.prepare(
    'INSERT INTO messages (session_id, branch_id, role, content, run_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    sessionId,
    session?.active_branch_id ?? null,
    role,
    content,
    runJson ? JSON.stringify(runJson) : null,
    nowIso(),
  )
}

export async function getSessionFacts(sessionId: number): Promise<Fact[]> {
  const db = await getDb()
  const rows = db
    .prepare(
      'SELECT key, value FROM session_facts WHERE session_id = ? ORDER BY key',
    )
    .all(sessionId) as Array<{ key: string; value: string }>
  return rows.map((row) => ({ key: row.key, value: row.value }))
}

export async function saveSessionFacts(
  sessionId: number,
  facts: Fact[],
): Promise<void> {
  const db = await getDb()
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM session_facts WHERE session_id = ?').run(sessionId)
    const insert = db.prepare(
      'INSERT INTO session_facts (session_id, key, value, updated_at) VALUES (?, ?, ?, ?)',
    )
    for (const fact of facts) {
      insert.run(sessionId, fact.key, fact.value, nowIso())
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export async function getWorkingMemory(
  sessionId: number,
): Promise<MemoryEntry[]> {
  const db = await getDb()
  const rows = db
    .prepare(
      'SELECT key, value, source, updated_at FROM working_memory WHERE session_id = ? ORDER BY key',
    )
    .all(sessionId) as Array<{
    key: string
    value: string
    source: string
    updated_at: string
  }>
  return rows.map((row) => ({
    layer: 'working' as const,
    key: row.key,
    value: row.value,
    source: row.source === 'manual' ? 'manual' : 'auto',
    updatedAt: row.updated_at,
    scenario: null,
  }))
}

export async function saveWorkingMemory(
  sessionId: number,
  entries: MemoryEntry[],
): Promise<void> {
  const db = await getDb()
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM working_memory WHERE session_id = ?').run(sessionId)
    const insert = db.prepare(
      'INSERT INTO working_memory (session_id, key, value, source, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
    for (const entry of entries) {
      insert.run(
        sessionId,
        entry.key,
        entry.value,
        entry.source,
        entry.updatedAt,
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export async function getLongTermMemory(token: string): Promise<MemoryEntry[]> {
  const db = await getDb()
  const rows = db
    .prepare(
      'SELECT key, value, source, scenario, updated_at FROM long_term_memory WHERE token = ? ORDER BY key',
    )
    .all(token) as Array<{
    key: string
    value: string
    source: string
    scenario: string | null
    updated_at: string
  }>
  return rows.map((row) => ({
    layer: 'long-term' as const,
    key: row.key,
    value: row.value,
    source: row.source === 'manual' ? 'manual' : 'auto',
    updatedAt: row.updated_at,
    scenario: row.scenario,
  }))
}

export async function saveLongTermMemory(
  token: string,
  entries: MemoryEntry[],
): Promise<void> {
  const db = await getDb()
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM long_term_memory WHERE token = ?').run(token)
    const insert = db.prepare(
      'INSERT INTO long_term_memory (token, key, value, source, scenario, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    for (const entry of entries) {
      insert.run(
        token,
        entry.key,
        entry.value,
        entry.source,
        entry.scenario ?? null,
        entry.updatedAt,
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export async function deleteMemoryEntry(
  scope: { sessionId: number } | { token: string },
  layer: MemoryLayer,
  key: string,
): Promise<void> {
  const db = await getDb()
  if (layer === 'working' && 'sessionId' in scope) {
    db.prepare(
      'DELETE FROM working_memory WHERE session_id = ? AND key = ?',
    ).run(scope.sessionId, key)
    return
  }
  if (layer === 'long-term' && 'token' in scope) {
    db.prepare('DELETE FROM long_term_memory WHERE token = ? AND key = ?').run(
      scope.token,
      key,
    )
  }
}
