import type { ProfileInput, ProfileRecord } from '../../domain/profile/types'
import { getDb, nowIso } from './db.server'

type ProfileRow = {
  id: number
  token: string
  name: string
  addressing: string | null
  tone: string | null
  language: string | null
  verbosity: string | null
  format: string | null
  constraints: string | null
  instructions: string | null
  is_default: number
  created_at: string
  updated_at: string
}

export type { ProfileRow }

const PROFILE_COLUMNS = `id, token, name, addressing, tone, language, verbosity, format, constraints, instructions, is_default, created_at, updated_at`

function mapProfile(row: ProfileRow): ProfileRecord {
  return {
    id: Number(row.id),
    token: row.token,
    name: row.name,
    addressing: row.addressing,
    tone: row.tone,
    language: row.language,
    verbosity: row.verbosity,
    format: row.format,
    constraints: row.constraints,
    instructions: row.instructions,
    isDefault: Number(row.is_default) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listProfiles(token: string): Promise<ProfileRecord[]> {
  const db = await getDb()
  const rows = db
    .prepare(
      `SELECT ${PROFILE_COLUMNS} FROM profiles WHERE token = ? ORDER BY is_default DESC, updated_at DESC, id DESC`,
    )
    .all(token) as ProfileRow[]
  return rows.map(mapProfile)
}

export async function getProfile(id: number): Promise<ProfileRecord | null> {
  const db = await getDb()
  const row = db
    .prepare(`SELECT ${PROFILE_COLUMNS} FROM profiles WHERE id = ?`)
    .get(id) as ProfileRow | undefined
  return row ? mapProfile(row) : null
}

export async function getDefaultProfile(
  token: string,
): Promise<ProfileRecord | null> {
  const db = await getDb()
  const row = db
    .prepare(
      `SELECT ${PROFILE_COLUMNS} FROM profiles WHERE token = ? AND is_default = 1 LIMIT 1`,
    )
    .get(token) as ProfileRow | undefined
  return row ? mapProfile(row) : null
}

export async function getDefaultProfileId(
  token: string,
): Promise<number | null> {
  const profile = await getDefaultProfile(token)
  return profile?.id ?? null
}

export async function createProfile(
  token: string,
  input: ProfileInput,
  options: { isDefault?: boolean } = {},
): Promise<ProfileRecord> {
  const db = await getDb()
  const count = db
    .prepare('SELECT COUNT(*) AS count FROM profiles WHERE token = ?')
    .get(token) as { count: number }
  const makeDefault = options.isDefault === true || Number(count?.count ?? 0) === 0
  if (makeDefault) {
    db.prepare('UPDATE profiles SET is_default = 0 WHERE token = ?').run(token)
  }
  const now = nowIso()
  const result = db
    .prepare(
      `INSERT INTO profiles (token, name, addressing, tone, language, verbosity, format, constraints, instructions, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      token,
      input.name,
      input.addressing ?? null,
      input.tone ?? null,
      input.language ?? null,
      input.verbosity ?? null,
      input.format ?? null,
      input.constraints ?? null,
      input.instructions ?? null,
      makeDefault ? 1 : 0,
      now,
      now,
    )
  const created = await getProfile(Number(result.lastInsertRowid))
  if (!created) {
    throw new Error('Не удалось создать профиль')
  }
  return created
}

export async function updateProfile(
  id: number,
  input: ProfileInput,
): Promise<ProfileRecord | null> {
  const db = await getDb()
  const existing = await getProfile(id)
  if (!existing) {
    return null
  }
  db.prepare(
    `UPDATE profiles SET
       name = ?,
       addressing = ?,
       tone = ?,
       language = ?,
       verbosity = ?,
       format = ?,
       constraints = ?,
       instructions = ?,
       updated_at = ?
     WHERE id = ?`,
  ).run(
    input.name,
    input.addressing ?? null,
    input.tone ?? null,
    input.language ?? null,
    input.verbosity ?? null,
    input.format ?? null,
    input.constraints ?? null,
    input.instructions ?? null,
    nowIso(),
    id,
  )
  return getProfile(id)
}

export async function setDefaultProfile(
  token: string,
  id: number,
): Promise<void> {
  const db = await getDb()
  const owned = db
    .prepare('SELECT 1 AS ok FROM profiles WHERE id = ? AND token = ?')
    .get(id, token)
  if (!owned) {
    throw new Error('Профиль не принадлежит пользователю')
  }
  db.exec('BEGIN')
  try {
    db.prepare('UPDATE profiles SET is_default = 0 WHERE token = ?').run(token)
    db.prepare(
      'UPDATE profiles SET is_default = 1, updated_at = ? WHERE id = ? AND token = ?',
    ).run(nowIso(), id, token)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export async function deleteProfile(id: number): Promise<void> {
  const db = await getDb()
  const profile = await getProfile(id)
  if (!profile) {
    return
  }
  db.exec('BEGIN')
  try {
    db.prepare('UPDATE sessions SET profile_id = NULL WHERE profile_id = ?').run(
      id,
    )
    db.prepare('DELETE FROM profiles WHERE id = ?').run(id)
    if (profile.isDefault) {
      const next = db
        .prepare(
          'SELECT id FROM profiles WHERE token = ? ORDER BY updated_at DESC, id DESC LIMIT 1',
        )
        .get(profile.token) as { id: number } | undefined
      if (next) {
        db.prepare(
          'UPDATE profiles SET is_default = 1, updated_at = ? WHERE id = ?',
        ).run(nowIso(), Number(next.id))
      }
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
