import { getDb, nowIso } from './db.server'
import { getSession } from './sessions.server'

export type BranchRow = {
  id: number
  session_id: number
  parent_branch_id: number | null
  fork_message_id: number | null
  title: string
  created_at: string
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
