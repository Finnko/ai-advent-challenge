import type { Fact } from '../../domain/facts'
import { getDb, nowIso } from './db.server'

export type SessionSummaryRow = {
  summary: string
  throughMessageId: number
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
