type SqliteDatabase = import('node:sqlite').DatabaseSync

const DB_FILENAME = 'agent.sqlite'
const DEFAULT_DB_DIR = '.ai-advent-challenge'
const BACKUP_LIMIT = 5

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
  ['Переговорка «Ладога»', '2026-09-10', '10:00', 60, 6, 'Синк команды', 'Анна'],
  [
    'Переговорка «Ладога»',
    '2026-09-10',
    '11:30',
    60,
    2,
    '1:1 с руководителем',
    'Мария',
  ],
  ['Переговорка «Байкал»', '2026-09-10', '14:00', 45, 8, 'Демо клиенту', 'Пётр'],
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

const PROFILES_SEED: Array<
  [
    token: string,
    name: string,
    addressing: string | null,
    tone: string | null,
    language: string | null,
    verbosity: string | null,
    format: string | null,
    constraints: string | null,
    instructions: string | null,
    isDefault: number,
  ]
> = [
  [
    'tok-manager-demo',
    'Формальный',
    'Анна',
    'деловой, официальный',
    'русский',
    'кратко',
    'структурированный список',
    'без сленга и эмодзи',
    '',
    1,
  ],
  [
    'tok-manager-demo',
    'Наставник',
    'Анна',
    'поддерживающий',
    'русский',
    'подробно',
    'пошаговый план',
    'не давать оценок сотрудникам',
    'Когда просят «напиши фичу» — сначала уточни требования, затем предложи план из трёх шагов: анализ, реализация, проверка.',
    0,
  ],
  [
    'tok-employee-demo',
    'Дружелюбный',
    'Пётр',
    'неформальный, дружелюбный',
    'французский',
    'средне',
    'короткие абзацы',
    'Pas de langue de bois.',
    'Réponds toujours en français, même si ma question est en russe. Tutoie-moi et propose toujours l’étape suivante.',
    1,
  ],
]

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
  memory_enabled INTEGER NOT NULL DEFAULT 0,
  profile_id INTEGER,
  window_size INTEGER NOT NULL DEFAULT 10,
  task_state_enabled INTEGER NOT NULL DEFAULT 0,
  invariant_set_id INTEGER,
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

CREATE TABLE IF NOT EXISTS task_states (
  session_id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  stage TEXT NOT NULL,
  previous_stage TEXT,
  step TEXT NOT NULL,
  steps_json TEXT NOT NULL DEFAULT '[]',
  step_index INTEGER NOT NULL DEFAULT 0,
  expected_actor TEXT NOT NULL,
  expected_description TEXT NOT NULL,
  history_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS working_memory (
  session_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, key)
);

CREATE TABLE IF NOT EXISTS long_term_memory (
  token TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto',
  scenario TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (token, key)
);

CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL,
  name TEXT NOT NULL,
  addressing TEXT,
  tone TEXT,
  language TEXT,
  verbosity TEXT,
  format TEXT,
  constraints TEXT,
  instructions TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_profiles_token ON profiles(token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_default ON profiles(token) WHERE is_default = 1;
`

let dbPromise: Promise<SqliteDatabase> | null = null

export function nowIso(): string {
  return new Date().toISOString()
}

export function safeParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
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
  migrateSeededBookings(db)
  migrateSessions(db)
  migrateProfiles(db)
  migrateTaskStates(db)
  seedPeople(db)
  seedBookings(db)
  seedProfiles(db)
  console.log(`[store] SQLite: ${dbPath}`)
  return db
}

export async function getDb(): Promise<SqliteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase()
  }
  return dbPromise
}

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

function seedBookings(db: SqliteDatabase): void {
  const row = db.prepare('SELECT COUNT(*) AS count FROM bookings').get() as {
    count: number
  }
  if ((row?.count ?? 0) > 0) {
    return
  }
  const insert = db.prepare(
    `INSERT INTO bookings (room, date, time, duration_min, capacity, title, reference, booked_by, participants, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  BOOKINGS_SEED.forEach((entry, index) => {
    const [room, date, time, durationMin, capacity, title, bookedBy] = entry
    insert.run(
      room,
      date,
      time,
      durationMin,
      capacity,
      title,
      `BOOK-SEED${String(index + 1).padStart(2, '0')}`,
      bookedBy,
      '[]',
      nowIso(),
    )
  })
}

export function migrateSeededBookings(db: SqliteDatabase): void {
  db.prepare(
    `UPDATE bookings
     SET booked_by = reference, reference = booked_by
     WHERE booked_by LIKE 'BOOK-SEED%' AND reference NOT LIKE 'BOOK-%'`,
  ).run()
}

function tableColumns(db: SqliteDatabase, table: string): string[] {
  return (
    db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  ).map((column) => column.name)
}

function seedProfiles(db: SqliteDatabase): void {
  const row = db.prepare('SELECT COUNT(*) AS count FROM profiles').get() as {
    count: number
  }
  if ((row?.count ?? 0) > 0) {
    return
  }
  const insert = db.prepare(
    `INSERT INTO profiles (token, name, addressing, tone, language, verbosity, format, constraints, instructions, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const entry of PROFILES_SEED) {
    const [
      token,
      name,
      addressing,
      tone,
      language,
      verbosity,
      format,
      constraints,
      instructions,
      isDefault,
    ] = entry
    const now = nowIso()
    insert.run(
      token,
      name,
      addressing,
      tone,
      language,
      verbosity,
      format,
      constraints,
      instructions && instructions.length > 0 ? instructions : null,
      isDefault,
      now,
      now,
    )
  }
}

export function migrateBookings(db: SqliteDatabase): void {
  const columns = tableColumns(db, 'bookings')
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
  if (!sessionColumns.includes('memory_enabled')) {
    db.exec(
      'ALTER TABLE sessions ADD COLUMN memory_enabled INTEGER NOT NULL DEFAULT 0',
    )
  }
  if (!sessionColumns.includes('profile_id')) {
    db.exec('ALTER TABLE sessions ADD COLUMN profile_id INTEGER')
  }
  if (!sessionColumns.includes('window_size')) {
    db.exec('ALTER TABLE sessions ADD COLUMN window_size INTEGER NOT NULL DEFAULT 10')
  }
  if (!sessionColumns.includes('task_state_enabled')) {
    db.exec(
      'ALTER TABLE sessions ADD COLUMN task_state_enabled INTEGER NOT NULL DEFAULT 0',
    )
  }
  if (!sessionColumns.includes('invariant_set_id')) {
    db.exec('ALTER TABLE sessions ADD COLUMN invariant_set_id INTEGER')
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

export function migrateTaskStates(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_states (
      session_id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      stage TEXT NOT NULL,
      previous_stage TEXT,
      step TEXT NOT NULL,
      steps_json TEXT NOT NULL DEFAULT '[]',
      step_index INTEGER NOT NULL DEFAULT 0,
      expected_actor TEXT NOT NULL,
      expected_description TEXT NOT NULL,
      history_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );
  `)
  const columns = tableColumns(db, 'task_states')
  if (!columns.includes('steps_json')) {
    db.exec(
      "ALTER TABLE task_states ADD COLUMN steps_json TEXT NOT NULL DEFAULT '[]'",
    )
  }
  if (!columns.includes('step_index')) {
    db.exec(
      'ALTER TABLE task_states ADD COLUMN step_index INTEGER NOT NULL DEFAULT 0',
    )
  }
}

export function migrateProfiles(db: SqliteDatabase): void {
  const token = 'tok-employee-demo'
  const name = 'Дружелюбный'
  const now = nowIso()
  db.prepare(
    'UPDATE profiles SET language = ?, updated_at = ? WHERE token = ? AND name = ? AND language = ?',
  ).run('французский', now, token, name, 'русский')
  db.prepare(
    'UPDATE profiles SET constraints = ?, updated_at = ? WHERE token = ? AND name = ? AND constraints = ?',
  ).run('Pas de langue de bois.', now, token, name, 'без канцелярита')
  db.prepare(
    'UPDATE profiles SET instructions = ?, updated_at = ? WHERE token = ? AND name = ? AND instructions = ?',
  ).run(
    'Réponds toujours en français, même si ma question est en russe. Tutoie-moi et propose toujours l’étape suivante.',
    now,
    token,
    name,
    'Обращайся на «ты» и предлагай следующий шаг.',
  )
}
