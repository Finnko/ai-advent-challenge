import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { callTool, listMcpTools } from '../server/mcp.server'

const TOOL_NAMES = [
  'bookings_by_room',
  'cancel_schedule',
  'db_overview',
  'echo',
  'employee_schedule',
  'get_weather_at',
  'get_weather_report',
  'list_schedules',
  'now',
  'run_due_jobs',
  'schedule_weather_report',
]

let dir: string

async function seedDatabase(dbPath: string): Promise<void> {
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(dbPath)
  db.exec(`
    CREATE TABLE people (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE sessions (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE vacations (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE invariants (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE profiles (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration_min INTEGER NOT NULL DEFAULT 60,
      capacity INTEGER NOT NULL,
      title TEXT NOT NULL,
      reference TEXT NOT NULL,
      booked_by TEXT NOT NULL,
      participants TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
  `)
  db.prepare(
    `INSERT INTO bookings
       (room, date, time, duration_min, capacity, title, reference, booked_by, participants, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'Переговорка «Ладога»',
    '2026-09-10',
    '10:00',
    60,
    6,
    'Синк команды',
    'BOOK-TEST01',
    'Анна',
    '[]',
    '2026-09-01T00:00:00.000Z',
  )
  db.close()
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'mcp-db-'))
  const dbPath = join(dir, 'agent.sqlite')
  await seedDatabase(dbPath)
  process.env.AGENT_DB_PATH = dbPath
  process.env.JOBS_DB_PATH = join(dir, 'jobs.sqlite')
})

afterAll(() => {
  delete process.env.AGENT_DB_PATH
  delete process.env.JOBS_DB_PATH
  rmSync(dir, { recursive: true, force: true })
})

describe('MCP connection', () => {
  it('connects over stdio and returns the registered tools', async () => {
    const result = await listMcpTools()

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.tools.map((tool) => tool.name).sort()).toEqual(TOOL_NAMES)

    const schedule = result.tools.find(
      (tool) => tool.name === 'employee_schedule',
    )
    expect(schedule?.description).toBeTruthy()
    expect(schedule?.inputSchema).toMatchObject({ type: 'object' })
  }, 20_000)

  it('calls a tool without arguments', async () => {
    const result = await callTool('now', {})

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Number.isNaN(Date.parse(result.text))).toBe(false)
    }
  }, 20_000)

  it('reads the agent database over MCP', async () => {
    const overview = await callTool('db_overview', {})
    expect(overview.ok).toBe(true)
    if (overview.ok) {
      expect(overview.text).toContain('Брони переговорок: 1')
    }

    const byRoom = await callTool('bookings_by_room', {})
    expect(byRoom.ok).toBe(true)
    if (byRoom.ok) {
      expect(byRoom.text).toContain('Переговорка «Ладога»: 1')
    }

    const schedule = await callTool('employee_schedule', {
      employeeName: 'анна',
    })
    expect(schedule.ok).toBe(true)
    if (schedule.ok) {
      expect(schedule.text).toContain('Синк команды')
    }
  }, 20_000)
})
