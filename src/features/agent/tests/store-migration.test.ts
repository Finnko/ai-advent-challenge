import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { migrateSessions } from '../server/store.server'

function legacyDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      run_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE session_summaries (
      session_id INTEGER PRIMARY KEY,
      summary TEXT NOT NULL,
      through_message_id INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      parent_branch_id INTEGER,
      fork_message_id INTEGER,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)
  db.prepare(
    "INSERT INTO sessions (token, title, created_at) VALUES ('t', 'старая сессия', '2020-01-01')",
  ).run()
  db.prepare(
    "INSERT INTO messages (session_id, role, content, created_at) VALUES (1, 'user', 'привет', '2020-01-01')",
  ).run()
  db.prepare(
    "INSERT INTO messages (session_id, role, content, created_at) VALUES (1, 'assistant', 'здравствуй', '2020-01-01')",
  ).run()
  return db
}

describe('migrateSessions', () => {
  it('добавляет колонки, корневую ветку и branch_id', () => {
    const db = legacyDatabase()
    migrateSessions(db)

    const session = db
      .prepare(
        'SELECT strategy, scenario, active_branch_id, profile_id FROM sessions WHERE id = 1',
      )
      .get() as {
      strategy: string
      scenario: string | null
      active_branch_id: number
      profile_id: number | null
    }
    expect(session.strategy).toBe('summary')
    expect(session.scenario).toBeNull()
    expect(session.profile_id).toBeNull()
    expect(session.active_branch_id).not.toBeNull()

    const branch = db
      .prepare(
        'SELECT parent_branch_id, fork_message_id, title FROM branches WHERE id = ?',
      )
      .get(session.active_branch_id) as {
      parent_branch_id: number | null
      fork_message_id: number | null
      title: string
    }
    expect(branch.parent_branch_id).toBeNull()
    expect(branch.fork_message_id).toBeNull()
    expect(branch.title).toBe('main')

    const messages = db
      .prepare('SELECT branch_id FROM messages ORDER BY id')
      .all() as Array<{ branch_id: number }>
    expect(messages).toHaveLength(2)
    for (const message of messages) {
      expect(message.branch_id).toBe(session.active_branch_id)
    }
  })

  it('идемпотентна при повторном запуске', () => {
    const db = legacyDatabase()
    migrateSessions(db)
    migrateSessions(db)

    const branches = db
      .prepare('SELECT COUNT(*) AS count FROM branches WHERE session_id = 1')
      .get() as { count: number }
    expect(branches.count).toBe(1)
  })
})
