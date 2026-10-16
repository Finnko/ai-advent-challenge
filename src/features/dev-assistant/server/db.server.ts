import { resolveStorePath } from '@lib/rag-engine.server'
import { FILE_INVARIANTS } from '../domain/file-invariants'

type SqliteDatabase = import('node:sqlite').DatabaseSync

const DB_FILENAME = 'dev-assistant-runs.sqlite'

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS file_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  state_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,
  goal TEXT NOT NULL,
  mode TEXT NOT NULL,
  scenario TEXT,
  plan_json TEXT,
  trace_json TEXT NOT NULL DEFAULT '[]',
  diff TEXT,
  answer TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_invariants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  check_id TEXT,
  pinned INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
`

let dbPromise: Promise<SqliteDatabase> | null = null

export function nowIso(): string {
  return new Date().toISOString()
}

function seedInvariants(db: SqliteDatabase): void {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO file_invariants (slug, category, title, text, check_id, pinned, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
  )
  for (const invariant of FILE_INVARIANTS) {
    insert.run(
      invariant.slug,
      invariant.category,
      invariant.title,
      invariant.text,
      invariant.check ?? null,
      nowIso(),
    )
  }
}

async function openDatabase(): Promise<SqliteDatabase> {
  const { DatabaseSync } = await import('node:sqlite')
  const { mkdir } = await import('node:fs/promises')
  const nodePath = await import('node:path')
  const dbPath = await resolveStorePath(
    'DEV_ASSISTANT_RUNS_DB_PATH',
    DB_FILENAME,
  )
  await mkdir(nodePath.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec(SCHEMA_SQL)
  seedInvariants(db)
  return db
}

export async function getRunsDb(): Promise<SqliteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase()
  }
  return dbPromise
}
