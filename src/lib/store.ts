import type { AgentRunResult, AgentStore, BookingRecord, VacationRecord } from './agent'

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
  created_at: string
}

export type MessageRow = {
  id: number
  session_id: number
  role: 'user' | 'assistant'
  content: string
  run_json: string | null
  created_at: string
}

export type SessionListItem = {
  id: number
  title: string
  createdAt: string
  lastMessage: string
  messageCount: number
}

export type StoredMessage = {
  role: 'user' | 'assistant'
  content: string
  run: AgentRunResult | null
}

type SqliteDatabase = import('node:sqlite').DatabaseSync

let dbPromise: Promise<SqliteDatabase> | null = null

function nowIso(): string {
  return new Date().toISOString()
}

async function openDatabase(): Promise<SqliteDatabase> {
  const { DatabaseSync } = await import('node:sqlite')
  const { mkdir } = await import('node:fs/promises')
  const nodePath = await import('node:path')
  const dir = nodePath.resolve(process.cwd(), 'data')
  await mkdir(dir, { recursive: true })
  const db = new DatabaseSync(nodePath.join(dir, 'agent.sqlite'))
  db.exec(SCHEMA_SQL)
  seedPeople(db)
  return db
}

async function getDb(): Promise<SqliteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase()
  }
  return dbPromise
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT NOT NULL,
  manager_token TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  run_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vacations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_name TEXT NOT NULL,
  approver_name TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reference TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  reference TEXT NOT NULL,
  booked_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
`

const PEOPLE_SEED: Array<
  [token: string, name: string, role: string, title: string, managerToken: string | null]
> = [
  ['tok-manager-demo', 'Анна', 'manager', 'Руководитель команды', null],
  ['tok-employee-demo', 'Пётр', 'employee', 'Линейный сотрудник', 'tok-manager-demo'],
  ['tok-employee-maria', 'Мария', 'employee', 'Линейный сотрудник', 'tok-manager-demo'],
  ['tok-employee-ivan', 'Иван', 'employee', 'Линейный сотрудник', 'tok-manager-demo'],
]

function seedPeople(db: SqliteDatabase): void {
  const row = db.prepare('SELECT COUNT(*) AS count FROM people').get() as {
    count: number
  }
  if ((row?.count ?? 0) > 0) {
    return
  }
  const insert = db.prepare(
    'INSERT INTO people (token, name, role, title, manager_token) VALUES (?, ?, ?, ?, ?)',
  )
  for (const person of PEOPLE_SEED) {
    insert.run(...person)
  }
}

export async function listPeople(): Promise<PersonRow[]> {
  const db = await getDb()
  return db
    .prepare(
      'SELECT id, token, name, role, title, manager_token FROM people ORDER BY id',
    )
    .all() as PersonRow[]
}

export async function getPersonByToken(token: string): Promise<PersonRow | null> {
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

export async function createSession(token: string, title: string): Promise<number> {
  const db = await getDb()
  const result = db
    .prepare('INSERT INTO sessions (token, title, created_at) VALUES (?, ?, ?)')
    .run(token, title, nowIso())
  return Number(result.lastInsertRowid)
}

export async function deleteSession(sessionId: number): Promise<void> {
  const db = await getDb()
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId)
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
        s.created_at AS created_at,
        (SELECT m.content FROM messages m WHERE m.session_id = s.id ORDER BY m.id DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS message_count
      FROM sessions s
      WHERE s.token = ?
      ORDER BY s.id DESC`,
    )
    .all(token) as Array<{
    id: number
    title: string
    created_at: string
    last_message: string | null
    message_count: number
  }>
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    lastMessage: row.last_message ?? '',
    messageCount: Number(row.message_count),
  }))
}

export async function loadMessages(sessionId: number): Promise<StoredMessage[]> {
  const db = await getDb()
  const rows = db
    .prepare(
      'SELECT role, content, run_json FROM messages WHERE session_id = ? ORDER BY id',
    )
    .all(sessionId) as Array<{ role: string; content: string; run_json: string | null }>
  return rows.map((row) => ({
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
    run: row.run_json ? (safeParse(row.run_json) as AgentRunResult) : null,
  }))
}

export async function appendMessage(
  sessionId: number,
  role: 'user' | 'assistant',
  content: string,
  runJson?: unknown,
): Promise<void> {
  const db = await getDb()
  db.prepare(
    'INSERT INTO messages (session_id, role, content, run_json, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(sessionId, role, content, runJson ? JSON.stringify(runJson) : null, nowIso())
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function createAgentStore(): AgentStore {
  return {
    async insertVacation(record: VacationRecord) {
      const db = await getDb()
      db.prepare(
        'INSERT INTO vacations (employee_name, approver_name, start_date, end_date, reference, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(
        record.employeeName,
        record.approverName,
        record.start,
        record.end,
        record.reference,
        record.status,
        nowIso(),
      )
    },
    async listVacations(approverName: string, subordinateNames: string[]) {
      const db = await getDb()
      const placeholders = subordinateNames.map(() => '?').join(', ')
      const rows = db
        .prepare(
          `SELECT employee_name, approver_name, start_date, end_date, reference, status, created_at
          FROM vacations
          WHERE (status = 'approved' AND approver_name = ?)
             OR (status = 'pending' AND employee_name IN (${placeholders}))
          ORDER BY id DESC`,
        )
        .all(approverName, ...subordinateNames) as Array<{
        employee_name: string
        approver_name: string | null
        start_date: string
        end_date: string
        reference: string
        status: string
        created_at: string
      }>
      return rows.map((row) => ({
        employeeName: row.employee_name,
        approverName: row.approver_name,
        start: row.start_date,
        end: row.end_date,
        reference: row.reference,
        status: row.status === 'approved' ? ('approved' as const) : ('pending' as const),
        createdAt: row.created_at,
      }))
    },
    async insertBooking(record: BookingRecord) {
      const db = await getDb()
      db.prepare(
        'INSERT INTO bookings (room, date, time, capacity, reference, booked_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(
        record.room,
        record.date,
        record.time,
        record.capacity,
        record.reference,
        record.bookedBy,
        nowIso(),
      )
    },
  }
}
