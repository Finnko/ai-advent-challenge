import { resolveStorePath } from '@lib/rag-engine.server'

type SqliteDatabase = import('node:sqlite').DatabaseSync

const DB_FILENAME = 'auto-review.sqlite'

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  stage TEXT,
  state_json TEXT,
  error TEXT,
  resumed_from INTEGER,
  browsers TEXT NOT NULL DEFAULT '[]',
  results_json TEXT NOT NULL DEFAULT '[]',
  zip_path TEXT,
  root_path TEXT,
  root_owned INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL,
  stage TEXT NOT NULL,
  state TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`

let dbPromise: Promise<SqliteDatabase> | null = null

export function nowIso(): string {
  return new Date().toISOString()
}

async function openDatabase(): Promise<SqliteDatabase> {
  const { DatabaseSync } = await import('node:sqlite')
  const { mkdir } = await import('node:fs/promises')
  const nodePath = await import('node:path')
  const dbPath = await resolveStorePath('AUTO_REVIEW_DB_PATH', DB_FILENAME)
  await mkdir(nodePath.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec(SCHEMA_SQL)
  migrate(db)
  return db
}

function migrate(db: SqliteDatabase): void {
  const columns = db.prepare('PRAGMA table_info(reviews)').all() as {
    name: string
  }[]
  if (!columns.some((column) => column.name === 'root_owned')) {
    db.exec(
      'ALTER TABLE reviews ADD COLUMN root_owned INTEGER NOT NULL DEFAULT 1',
    )
  }
}

export async function getDb(): Promise<SqliteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase()
  }
  return dbPromise
}
