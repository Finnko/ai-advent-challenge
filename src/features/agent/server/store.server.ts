import type {
  AgentRunResult,
  AgentStore,
  BookingRecord,
  VacationRecord,
} from '../domain/agent'
import { normalizeName } from '../domain/agent-tools'
import type { ContextStrategyId } from '../domain/context/types'
import type { Fact } from '../domain/facts'

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
  role: 'user' | 'assistant'
  content: string
  run_json: string | null
  created_at: string
}

export type SessionListItem = {
  id: number
  title: string
  strategy: ContextStrategyId
  scenario: string | null
  createdAt: string
  lastMessage: string
  messageCount: number
}

export type StoredMessage = {
  id: number
  role: 'user' | 'assistant'
  content: string
  run: AgentRunResult | null
}

export type SessionSummaryRow = {
  summary: string
  throughMessageId: number
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
  migrateSessions(db)
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
  strategy TEXT NOT NULL DEFAULT 'summary',
  scenario TEXT,
  active_branch_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  branch_id INTEGER,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  run_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  parent_branch_id INTEGER,
  fork_message_id INTEGER,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_facts (
  session_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, key)
);

CREATE TABLE IF NOT EXISTS scenario_checklists (
  token TEXT NOT NULL,
  scenario TEXT NOT NULL,
  items_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (token, scenario)
);

CREATE TABLE IF NOT EXISTS session_summaries (
  session_id INTEGER PRIMARY KEY,
  summary TEXT NOT NULL,
  through_message_id INTEGER NOT NULL,
  updated_at TEXT NOT NULL
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

function tableColumns(db: SqliteDatabase, table: string): string[] {
  return (
    db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  ).map((column) => column.name)
}

export function migrateSessions(db: SqliteDatabase): void {
  const sessionColumns = tableColumns(db, 'sessions')
  if (!sessionColumns.includes('strategy')) {
    db.exec(
      "ALTER TABLE sessions ADD COLUMN strategy TEXT NOT NULL DEFAULT 'summary'",
    )
  }
  if (!sessionColumns.includes('scenario')) {
    db.exec('ALTER TABLE sessions ADD COLUMN scenario TEXT')
  }
  if (!sessionColumns.includes('active_branch_id')) {
    db.exec('ALTER TABLE sessions ADD COLUMN active_branch_id INTEGER')
  }
  const messageColumns = tableColumns(db, 'messages')
  if (!messageColumns.includes('branch_id')) {
    db.exec('ALTER TABLE messages ADD COLUMN branch_id INTEGER')
  }
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_messages_branch ON messages(branch_id, id)',
  )
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_branches_session ON branches(session_id, id)',
  )

  const sessions = db
    .prepare('SELECT id FROM sessions WHERE active_branch_id IS NULL')
    .all() as Array<{ id: number }>
  if (sessions.length === 0) {
    return
  }
  const insertBranch = db.prepare(
    'INSERT INTO branches (session_id, parent_branch_id, fork_message_id, title, created_at) VALUES (?, NULL, NULL, ?, ?)',
  )
  const setActive = db.prepare(
    'UPDATE sessions SET active_branch_id = ? WHERE id = ?',
  )
  const backfill = db.prepare(
    'UPDATE messages SET branch_id = ? WHERE session_id = ? AND branch_id IS NULL',
  )
  for (const session of sessions) {
    const result = insertBranch.run(session.id, 'main', nowIso())
    const branchId = Number(result.lastInsertRowid)
    setActive.run(branchId, session.id)
    backfill.run(branchId, session.id)
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
  options: {
    strategy?: ContextStrategyId
    scenario?: string | null
  } = {},
): Promise<number> {
  const db = await getDb()
  const strategy = options.strategy ?? 'summary'
  const scenario = options.scenario ?? null
  const result = db
    .prepare(
      'INSERT INTO sessions (token, title, strategy, scenario, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(token, title, strategy, scenario, nowIso())
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

export async function getSession(sessionId: number): Promise<SessionRow | null> {
  const db = await getDb()
  const row = db
    .prepare(
      'SELECT id, token, title, strategy, scenario, active_branch_id, created_at FROM sessions WHERE id = ?',
    )
    .get(sessionId) as
    | {
        id: number
        token: string
        title: string
        strategy: string
        scenario: string | null
        active_branch_id: number | null
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

export async function listSessionsByScenario(
  token: string,
  scenario: string,
): Promise<Array<{ id: number; title: string; strategy: ContextStrategyId }>> {
  const db = await getDb()
  const rows = db
    .prepare(
      'SELECT id, title, strategy FROM sessions WHERE token = ? AND scenario = ? ORDER BY id',
    )
    .all(token, scenario) as Array<{
    id: number
    title: string
    strategy: string
  }>
  return rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    strategy: row.strategy as ContextStrategyId,
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

export async function createBranch(
  sessionId: number,
  fromMessageId: number | null,
  title: string,
  sourceBranchId: number | null = null,
): Promise<number> {
  const db = await getDb()
  const sourceId =
    sourceBranchId ??
    (fromMessageId === null
      ? (await getActiveBranch(sessionId))?.id ?? null
      : await branchIdForMessage(sessionId, fromMessageId))
  const result = db
    .prepare(
      'INSERT INTO branches (session_id, parent_branch_id, fork_message_id, title, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(sessionId, sourceId, fromMessageId, title, nowIso())
  const branchId = Number(result.lastInsertRowid)
  if (sourceId !== null) {
    const filter = fromMessageId === null ? '' : 'AND id <= ?'
    const params: Array<number> =
      fromMessageId === null ? [branchId, sourceId] : [branchId, sourceId, fromMessageId]
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
        s.created_at AS created_at,
        (SELECT m.content FROM messages m WHERE m.session_id = s.id AND m.branch_id = s.active_branch_id ORDER BY m.id DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id AND m.branch_id = s.active_branch_id) AS message_count
      FROM sessions s
      WHERE s.token = ?
      ORDER BY s.id DESC`,
    )
    .all(token) as Array<{
    id: number
    title: string
    strategy: string
    scenario: string | null
    created_at: string
    last_message: string | null
    message_count: number
  }>
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    strategy: row.strategy as ContextStrategyId,
    scenario: row.scenario,
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
  return rows.map((row) => ({
    id: Number(row.id),
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
    run: row.run_json ? (safeParse(row.run_json) as AgentRunResult) : null,
  }))
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
  role: 'user' | 'assistant',
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

export async function getScenarioChecklist(
  token: string,
  scenario: string,
): Promise<string[]> {
  const db = await getDb()
  const row = db
    .prepare(
      'SELECT items_json FROM scenario_checklists WHERE token = ? AND scenario = ?',
    )
    .get(token, scenario) as { items_json: string } | undefined
  if (!row) {
    return []
  }
  const parsed = safeParse(row.items_json)
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === 'string')
    : []
}

export async function saveScenarioChecklist(
  token: string,
  scenario: string,
  items: string[],
): Promise<void> {
  const db = await getDb()
  db.prepare(
    `INSERT INTO scenario_checklists (token, scenario, items_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(token, scenario) DO UPDATE SET
       items_json = excluded.items_json,
       updated_at = excluded.updated_at`,
  ).run(token, scenario, JSON.stringify(items), nowIso())
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
            booking.participants.some((name) => normalizeName(name) === self),
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
