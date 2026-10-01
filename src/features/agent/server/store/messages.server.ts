import type { AgentRunResult } from '../../domain/agent'
import type { TaskEvent } from '../../domain/task/types'
import { getDb, nowIso, safeParse } from './db.server'
import { getSession } from './sessions.server'

export type MessageRow = {
  id: number
  session_id: number
  role: 'user' | 'assistant' | 'task'
  content: string
  run_json: string | null
  created_at: string
}

export type StoredMessage = {
  id: number
  role: 'user' | 'assistant' | 'task'
  content: string
  run: AgentRunResult | null
  taskEvent?: TaskEvent | null
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
        taskEvent: row.run_json ? (safeParse(row.run_json) as TaskEvent) : null,
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
