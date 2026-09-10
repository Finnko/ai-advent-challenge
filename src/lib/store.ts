import type {
  AgentRunResult,
  AgentStore,
  BookingRecord,
  VacationRecord,
} from './agent'
import { normalizeName } from './agent-tools'

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

const DB_FILENAME = 'agent.sqlite'
const DEFAULT_DB_DIR = '.ai-advent-challenge'
const BACKUP_LIMIT = 5

let dbPromise: Promise<SqliteDatabase> | null = null

function nowIso(): string {
  return new Date().toISOString()
}

async function pathExists(target: string): Promise<boolean> {
  const { access } = await import('node:fs/promises')
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

async function resolveDbPath(): Promise<string> {
  const nodePath = await import('node:path')
  const os = await import('node:os')
  const override = process.env.AGENT_DB_PATH?.trim()
  if (override) {
    const resolved = nodePath.resolve(override)
    const { stat } = await import('node:fs/promises')
    try {
      if ((await stat(resolved)).isDirectory()) {
        return nodePath.join(resolved, DB_FILENAME)
      }
    } catch {
      return resolved
    }
    return resolved
  }
  return nodePath.join(os.homedir(), DEFAULT_DB_DIR, DB_FILENAME)
}

async function migrateLegacyDatabase(dbPath: string): Promise<void> {
  const nodePath = await import('node:path')
  const { mkdir, rename, copyFile } = await import('node:fs/promises')
  const legacy = nodePath.resolve(process.cwd(), 'data', DB_FILENAME)
  if (legacy === dbPath) {
    return
  }
  if (await pathExists(dbPath)) {
    return
  }
  if (!(await pathExists(legacy))) {
    return
  }
  await mkdir(nodePath.dirname(dbPath), { recursive: true })
  try {
    await rename(legacy, dbPath)
  } catch {
    await copyFile(legacy, dbPath)
  }
  console.log(`[store] перенёс базу ${legacy} → ${dbPath}`)
}

async function backupDatabase(dbPath: string): Promise<void> {
  const nodePath = await import('node:path')
  const { mkdir, copyFile, readdir, rm } = await import('node:fs/promises')
  if (!(await pathExists(dbPath))) {
    return
  }
  const backupDir = `${dbPath}.backups`
  await mkdir(backupDir, { recursive: true })
  const stamp = nowIso().replace(/[:.]/g, '-')
  await copyFile(dbPath, nodePath.join(backupDir, `agent-${stamp}.sqlite`))
  const files = (await readdir(backupDir))
    .filter((name) => name.endsWith('.sqlite'))
    .sort()
  const excess = files.slice(0, Math.max(0, files.length - BACKUP_LIMIT))
  for (const name of excess) {
    await rm(nodePath.join(backupDir, name), { force: true })
  }
}

async function openDatabase(): Promise<SqliteDatabase> {
  const { DatabaseSync } = await import('node:sqlite')
  const { mkdir } = await import('node:fs/promises')
  const nodePath = await import('node:path')
  const dbPath = await resolveDbPath()
  await mkdir(nodePath.dirname(dbPath), { recursive: true })
  await migrateLegacyDatabase(dbPath)
  if (await pathExists(dbPath)) {
    await backupDatabase(dbPath)
  }
  const db = new DatabaseSync(dbPath)
  db.exec(SCHEMA_SQL)
  migrateBookings(db)
  seedPeople(db)
  seedBookings(db)
  console.log(`[store] SQLite: ${dbPath}`)
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
  duration_min INTEGER NOT NULL DEFAULT 60,
  capacity INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT 'Встреча',
  reference TEXT NOT NULL,
  booked_by TEXT NOT NULL,
  participants TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
`

const PEOPLE_SEED: Array<
  [
    token: string,
    name: string,
    role: string,
    title: string,
    managerToken: string | null,
  ]
> = [
  ['tok-manager-demo', 'Анна', 'manager', 'Руководитель команды', null],
  [
    'tok-employee-demo',
    'Пётр',
    'employee',
    'Линейный сотрудник',
    'tok-manager-demo',
  ],
  [
    'tok-employee-maria',
    'Мария',
    'employee',
    'Линейный сотрудник',
    'tok-manager-demo',
  ],
  [
    'tok-employee-ivan',
    'Иван',
    'employee',
    'Линейный сотрудник',
    'tok-manager-demo',
  ],
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

function migrateBookings(db: SqliteDatabase): void {
  const columns = (
    db.prepare('PRAGMA table_info(bookings)').all() as Array<{ name: string }>
  ).map((column) => column.name)
  if (!columns.includes('title')) {
    db.exec(
      "ALTER TABLE bookings ADD COLUMN title TEXT NOT NULL DEFAULT 'Встреча'",
    )
  }
  if (!columns.includes('duration_min')) {
    db.exec(
      'ALTER TABLE bookings ADD COLUMN duration_min INTEGER NOT NULL DEFAULT 60',
    )
  }
  if (!columns.includes('participants')) {
    db.exec(
      "ALTER TABLE bookings ADD COLUMN participants TEXT NOT NULL DEFAULT '[]'",
    )
  }
}

const BOOKINGS_SEED: Array<
  [
    room: string,
    date: string,
    time: string,
    durationMin: number,
    capacity: number,
    title: string,
    bookedBy: string,
  ]
> = [
  [
    'Переговорка «Ладога»',
    '2026-09-10',
    '10:00',
    60,
    6,
    'Синк команды',
    'Анна',
  ],
  [
    'Переговорка «Ладога»',
    '2026-09-10',
    '11:30',
    60,
    2,
    '1:1 с руководителем',
    'Мария',
  ],
  [
    'Переговорка «Байкал»',
    '2026-09-10',
    '14:00',
    45,
    8,
    'Демо клиенту',
    'Пётр',
  ],
  [
    'Переговорка «Онега»',
    '2026-09-11',
    '09:00',
    90,
    10,
    'Планирование спринта',
    'Анна',
  ],
  [
    'Переговорка «Ладога»',
    '2026-09-11',
    '10:30',
    60,
    5,
    'Ретро по спринту',
    'Иван',
  ],
  ['Переговорка «Байкал»', '2026-09-11', '09:30', 60, 4, 'Код-ревью', 'Пётр'],
  [
    'Переговорка «Ладога»',
    '2026-09-12',
    '15:00',
    120,
    8,
    'Стратегия квартала',
    'Анна',
  ],
]

function seedBookings(db: SqliteDatabase): void {
  const row = db.prepare('SELECT COUNT(*) AS count FROM bookings').get() as {
    count: number
  }
  if ((row?.count ?? 0) > 0) {
    return
  }
  const insert = db.prepare(
    `INSERT INTO bookings (room, date, time, duration_min, capacity, title, reference, booked_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  BOOKINGS_SEED.forEach((entry, index) => {
    insert.run(
      ...entry,
      `BOOK-SEED${String(index + 1).padStart(2, '0')}`,
      nowIso(),
    )
  })
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
): Promise<number> {
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

export async function loadMessages(
  sessionId: number,
): Promise<StoredMessage[]> {
  const db = await getDb()
  const rows = db
    .prepare(
      'SELECT role, content, run_json FROM messages WHERE session_id = ? ORDER BY id',
    )
    .all(sessionId) as Array<{
    role: string
    content: string
    run_json: string | null
  }>
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
  ).run(
    sessionId,
    role,
    content,
    runJson ? JSON.stringify(runJson) : null,
    nowIso(),
  )
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

type VacationRow = {
  employee_name: string
  approver_name: string | null
  start_date: string
  end_date: string
  reference: string
  status: string
  created_at: string
}

function vacationFromRow(row: VacationRow): VacationRecord {
  return {
    employeeName: row.employee_name,
    approverName: row.approver_name,
    start: row.start_date,
    end: row.end_date,
    reference: row.reference,
    status:
      row.status === 'approved' ? ('approved' as const) : ('pending' as const),
    createdAt: row.created_at,
  }
}

type BookingRow = {
  room: string
  date: string
  time: string
  duration_min: number
  capacity: number
  title: string
  reference: string
  booked_by: string
  participants: string
  created_at: string
}

function parseParticipants(value: string | null): string[] {
  if (!value) {
    return []
  }
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((name): name is string => typeof name === 'string')
    }
  } catch {
    return []
  }
  return []
}

function bookingFromRow(row: BookingRow): BookingRecord {
  return {
    room: row.room,
    date: row.date,
    time: row.time,
    durationMin: Number(row.duration_min),
    capacity: Number(row.capacity),
    title: row.title,
    reference: row.reference,
    bookedBy: row.booked_by,
    participants: parseParticipants(row.participants),
    createdAt: row.created_at,
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map((part) => Number(part) || 0)
  return hours * 60 + minutes
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
        .all(approverName, ...subordinateNames) as VacationRow[]
      return rows.map(vacationFromRow)
    },
    async findPendingVacation(
      employeeName: string,
      start: string,
      end: string,
    ) {
      const db = await getDb()
      const rows = db
        .prepare(
          `SELECT employee_name, approver_name, start_date, end_date, reference, status, created_at
          FROM vacations
          WHERE employee_name = ? AND start_date = ? AND end_date = ? AND status = 'pending'
          ORDER BY id DESC
          LIMIT 1`,
        )
        .all(employeeName, start, end) as VacationRow[]
      return rows.length > 0 ? vacationFromRow(rows[0]) : null
    },
    async latestPendingVacation(subordinateNames: string[]) {
      if (subordinateNames.length === 0) {
        return null
      }
      const db = await getDb()
      const placeholders = subordinateNames.map(() => '?').join(', ')
      const rows = db
        .prepare(
          `SELECT employee_name, approver_name, start_date, end_date, reference, status, created_at
          FROM vacations
          WHERE status = 'pending' AND employee_name IN (${placeholders})
          ORDER BY id DESC
          LIMIT 1`,
        )
        .all(...subordinateNames) as VacationRow[]
      return rows.length > 0 ? vacationFromRow(rows[0]) : null
    },
    async markVacationApproved(reference: string, approverName: string) {
      const db = await getDb()
      db.prepare(
        "UPDATE vacations SET status = 'approved', approver_name = ? WHERE reference = ? AND status = 'pending'",
      ).run(approverName, reference)
    },
    async insertBooking(record: BookingRecord) {
      const db = await getDb()
      db.prepare(
        `INSERT INTO bookings (room, date, time, duration_min, capacity, title, reference, booked_by, participants, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        record.room,
        record.date,
        record.time,
        record.durationMin,
        record.capacity,
        record.title,
        record.reference,
        record.bookedBy,
        JSON.stringify(record.participants ?? []),
        nowIso(),
      )
    },
    async listBookings(bookedBy: string, subordinateNames: string[]) {
      const db = await getDb()
      const owners = new Set(
        [bookedBy, ...subordinateNames].map((name) => normalizeName(name)),
      )
      const self = normalizeName(bookedBy)
      const rows = db
        .prepare(
          `SELECT room, date, time, duration_min, capacity, title, reference, booked_by, participants, created_at
          FROM bookings
          ORDER BY date, time, id`,
        )
        .all() as BookingRow[]
      return rows
        .map(bookingFromRow)
        .filter(
          (booking) =>
            owners.has(normalizeName(booking.bookedBy)) ||
            booking.participants.some(
              (name) => normalizeName(name) === self,
            ),
        )
    },
    async listBookingsOnDate(date: string) {
      const db = await getDb()
      const rows = db
        .prepare(
          `SELECT room, date, time, duration_min, capacity, title, reference, booked_by, participants, created_at
          FROM bookings
          WHERE date = ?
          ORDER BY time, id`,
        )
        .all(date) as BookingRow[]
      return rows.map(bookingFromRow)
    },
    async latestManagedBookingFor(
      bookedBy: string,
      subordinateNames: string[],
    ) {
      const db = await getDb()
      const names = [bookedBy, ...subordinateNames]
      const placeholders = names.map(() => '?').join(', ')
      const rows = db
        .prepare(
          `SELECT room, date, time, duration_min, capacity, title, reference, booked_by, participants, created_at
          FROM bookings
          WHERE booked_by IN (${placeholders})
          ORDER BY date DESC, time DESC, id DESC
          LIMIT 1`,
        )
        .all(...names) as BookingRow[]
      return rows.length > 0 ? bookingFromRow(rows[0]) : null
    },
    async findBooking(room: string, date: string, time: string) {
      const db = await getDb()
      const rows = db
        .prepare(
          `SELECT room, date, time, duration_min, capacity, title, reference, booked_by, participants, created_at
          FROM bookings
          WHERE room = ? AND date = ? AND time = ?
          LIMIT 1`,
        )
        .all(room, date, time) as BookingRow[]
      return rows.length > 0 ? bookingFromRow(rows[0]) : null
    },
    async updateBookingParticipants(
      room: string,
      date: string,
      time: string,
      participants: string[],
    ) {
      const db = await getDb()
      db.prepare(
        'UPDATE bookings SET participants = ? WHERE room = ? AND date = ? AND time = ?',
      ).run(JSON.stringify(participants), room, date, time)
    },
    async deleteBooking(room: string, date: string, time: string) {
      const db = await getDb()
      db.prepare(
        'DELETE FROM bookings WHERE room = ? AND date = ? AND time = ?',
      ).run(room, date, time)
    },
    async findOverlap(
      room: string,
      date: string,
      time: string,
      durationMin: number,
    ) {
      const db = await getDb()
      const minutes = timeToMinutes(time)
      const rows = db
        .prepare(
          `SELECT room, date, time, duration_min, capacity, title, reference, booked_by, created_at
          FROM bookings
          WHERE room = ? AND date = ?
            AND (CAST(substr(time, 1, 2) AS INTEGER) * 60 + CAST(substr(time, 4, 2) AS INTEGER)) < ?
            AND (CAST(substr(time, 1, 2) AS INTEGER) * 60 + CAST(substr(time, 4, 2) AS INTEGER) + duration_min) > ?
          ORDER BY time`,
        )
        .all(room, date, minutes + durationMin, minutes) as BookingRow[]
      return rows.map(bookingFromRow)
    },
  }
}
