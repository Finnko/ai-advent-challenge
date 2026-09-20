import type { InvariantInput, InvariantRecord, InvariantUpdateInput } from '../../domain/invariants/types'
import { getDb, nowIso } from './db.server'

type InvariantRow = {
  id: number
  token: string
  slug: string
  category: InvariantRecord['category']
  title: string
  text: string
  check_id: InvariantRecord['check']
  pinned: number
}

function fromRow(row: InvariantRow): InvariantRecord {
  return { ...row, check: row.check_id, pinned: row.pinned === 1 }
}

const columns = 'id, token, slug, category, title, text, check_id, pinned'

export async function listInvariants(token: string): Promise<InvariantRecord[]> {
  const db = await getDb()
  return (db.prepare(`SELECT ${columns} FROM invariants WHERE token = ? ORDER BY id`).all(token) as InvariantRow[]).map(fromRow)
}

export async function getInvariant(token: string, id: number): Promise<InvariantRecord | null> {
  const db = await getDb()
  const row = db.prepare(`SELECT ${columns} FROM invariants WHERE token = ? AND id = ?`).get(token, id) as InvariantRow | undefined
  return row ? fromRow(row) : null
}

export async function createInvariant(token: string, input: InvariantInput): Promise<InvariantRecord> {
  const db = await getDb()
  const result = db.prepare('INSERT INTO invariants (token, slug, category, title, text, check_id, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)').run(token, input.slug, input.category, input.title, input.text, input.check ?? null, nowIso(), nowIso())
  return (await getInvariant(token, Number(result.lastInsertRowid))) as InvariantRecord
}

export async function updateInvariant(token: string, id: number, input: InvariantUpdateInput): Promise<InvariantRecord> {
  const db = await getDb()
  const current = await getInvariant(token, id)
  if (!current) {
    throw new Error('Инвариант не найден')
  }
  const check = current.pinned ? current.check : input.check ?? null
  db.prepare('UPDATE invariants SET category = ?, title = ?, text = ?, check_id = ?, updated_at = ? WHERE token = ? AND id = ?').run(input.category, input.title, input.text, check, nowIso(), token, id)
  return (await getInvariant(token, id)) as InvariantRecord
}

export async function deleteInvariant(token: string, id: number): Promise<boolean> {
  const db = await getDb()
  const result = db.prepare('DELETE FROM invariants WHERE token = ? AND id = ? AND pinned = 0').run(token, id)
  return Number(result.changes) > 0
}
