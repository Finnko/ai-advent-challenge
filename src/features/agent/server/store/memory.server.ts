import type { MemoryEntry, MemoryLayer } from '../../domain/memory/types'
import { getDb } from './db.server'

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
