type SqliteDatabase = import('node:sqlite').DatabaseSync

const DB_FILENAME = 'agent.sqlite'
const DEFAULT_DB_DIR = '.ai-advent-challenge'

async function resolveDbPath(): Promise<string> {
  const nodePath = await import('node:path')
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
  const os = await import('node:os')
  return nodePath.join(os.homedir(), DEFAULT_DB_DIR, DB_FILENAME)
}

async function withReadonlyDb<T>(fn: (db: SqliteDatabase) => T): Promise<T> {
  const { DatabaseSync } = await import('node:sqlite')
  const { access } = await import('node:fs/promises')
  const dbPath = await resolveDbPath()
  try {
    await access(dbPath)
  } catch {
    throw new Error(`База данных не найдена: ${dbPath}`)
  }
  const db = new DatabaseSync(dbPath, { readOnly: true, timeout: 2000 })
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const RANGE_START = '0000-01-01'
const RANGE_END = '9999-12-31'

function normalizeRange(from?: string, to?: string): [string, string] {
  return [from && from.trim() ? from.trim() : RANGE_START, to && to.trim() ? to.trim() : RANGE_END]
}

type CountRow = {
  people: number
  sessions: number
  messages: number
  bookings: number
  vacations: number
  invariants: number
  profiles: number
}

export async function dbOverview(): Promise<string> {
  const row = await withReadonlyDb(
    (db) =>
      db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM people) AS people,
             (SELECT COUNT(*) FROM sessions) AS sessions,
             (SELECT COUNT(*) FROM messages) AS messages,
             (SELECT COUNT(*) FROM bookings) AS bookings,
             (SELECT COUNT(*) FROM vacations) AS vacations,
             (SELECT COUNT(*) FROM invariants) AS invariants,
             (SELECT COUNT(*) FROM profiles) AS profiles`,
        )
        .get() as CountRow,
  )
  return [
    'Обзор базы данных агента:',
    `- Сотрудники: ${row.people}`,
    `- Сессии: ${row.sessions}`,
    `- Сообщения: ${row.messages}`,
    `- Брони переговорок: ${row.bookings}`,
    `- Заявки на отпуск: ${row.vacations}`,
    `- Инварианты: ${row.invariants}`,
    `- Профили: ${row.profiles}`,
  ].join('\n')
}

type RoomRow = { room: string; count: number }

export async function bookingsByRoom(from?: string, to?: string): Promise<string> {
  const [start, end] = normalizeRange(from, to)
  const rows = await withReadonlyDb(
    (db) =>
      db
        .prepare(
          `SELECT room, COUNT(*) AS count FROM bookings
           WHERE date >= ? AND date <= ?
           GROUP BY room
           ORDER BY count DESC, room ASC`,
        )
        .all(start, end) as RoomRow[],
  )
  if (rows.length === 0) {
    return 'За выбранный период брони отсутствуют.'
  }
  const lines = rows.map((row) => `- ${row.room}: ${row.count}`)
  return ['Брони по переговоркам:', ...lines].join('\n')
}

type BookingRow = {
  booked_by: string
  date: string
  time: string
  duration_min: number
  room: string
  title: string
}

export async function employeeSchedule(
  employeeName: string,
  from?: string,
  to?: string,
): Promise<string> {
  const name = employeeName.trim()
  if (!name) {
    return 'Не указано имя сотрудника.'
  }
  const [start, end] = normalizeRange(from, to)
  const key = name.toLowerCase()
  const rows = (
    await withReadonlyDb(
      (db) =>
        db
          .prepare(
            `SELECT booked_by, date, time, duration_min, room, title FROM bookings
             WHERE date >= ? AND date <= ?
             ORDER BY date ASC, time ASC`,
          )
          .all(start, end) as BookingRow[],
    )
  ).filter((row) => row.booked_by.trim().toLowerCase() === key)
  if (rows.length === 0) {
    return `У сотрудника ${name} встреч не найдено.`
  }
  const lines = rows.map(
    (row) =>
      `- ${row.date} ${row.time} (${row.duration_min} мин) · ${row.room} — ${row.title}`,
  )
  return [`Встречи сотрудника ${name}:`, ...lines].join('\n')
}
