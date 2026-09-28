import { getDb } from './db.server'

export type PersonRow = {
  id: number
  token: string
  name: string
  role: 'employee' | 'manager'
  title: string
  manager_token: string | null
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
