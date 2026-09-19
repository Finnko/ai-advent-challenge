import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { migrateInvariants, migrateSessions, migrateTaskStates } from '../server/store.server'

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
        'SELECT strategy, scenario, active_branch_id, profile_id, window_size, task_state_enabled, invariant_set_id FROM sessions WHERE id = 1',
      )
      .get() as {
      strategy: string
      scenario: string | null
      active_branch_id: number
      profile_id: number | null
      window_size: number
      task_state_enabled: number
      invariant_set_id: number | null
    }
    expect(session.strategy).toBe('summary')
    expect(session.scenario).toBeNull()
    expect(session.profile_id).toBeNull()
    expect(session.window_size).toBe(10)
    expect(session.task_state_enabled).toBe(0)
    expect(session.invariant_set_id).toBeNull()
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

    const session = db
      .prepare(
        'SELECT window_size, task_state_enabled, invariant_set_id FROM sessions WHERE id = 1',
      )
      .get() as {
      window_size: number
      task_state_enabled: number
      invariant_set_id: number | null
    }
    expect(session.window_size).toBe(10)
    expect(session.task_state_enabled).toBe(0)
    expect(session.invariant_set_id).toBeNull()
  })
})

describe('migrateTaskStates', () => {
  it('создаёт таблицу task_states и идемпотентна', () => {
    const db = new DatabaseSync(':memory:')
    migrateTaskStates(db)
    migrateTaskStates(db)

    const columns = (
      db.prepare('PRAGMA table_info(task_states)').all() as Array<{
        name: string
      }>
    ).map((column) => column.name)
    expect(columns).toEqual(
      expect.arrayContaining([
        'session_id',
        'title',
        'stage',
        'previous_stage',
        'step',
        'expected_actor',
        'expected_description',
        'history_json',
        'updated_at',
      ]),
    )
  })
})

describe('migrateInvariants', () => {
  it('replaces global slug uniqueness with pinned-only uniqueness', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`
      CREATE TABLE invariants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL,
        slug TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        check_id TEXT,
        pinned INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (token, slug)
      );
      INSERT INTO invariants (token, slug, category, title, text, check_id, pinned, created_at, updated_at)
      VALUES ('t', 'rule', 'business', 'Правило', 'Текст', NULL, 1, 'now', 'now');
    `)

    migrateInvariants(db)
    migrateInvariants(db)

    db.prepare(
      'INSERT INTO invariants (token, slug, category, title, text, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
    ).run('t', 'rule', 'business', 'Кастомное', 'Текст', 'now', 'now')
    expect(() =>
      db.prepare(
        'INSERT INTO invariants (token, slug, category, title, text, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
      ).run('t', 'rule', 'business', 'Дубликат', 'Текст', 'now', 'now'),
    ).toThrow()
  })
})
