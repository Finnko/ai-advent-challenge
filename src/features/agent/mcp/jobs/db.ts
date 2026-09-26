import type {
  RunRecord,
  RunSource,
  RunStatus,
  Schedule,
  Summary,
  SummaryValue,
  WeatherSample,
} from '../../domain/jobs/types.ts'
import { WEATHER_KIND } from '../../domain/jobs/types.ts'
import { retentionCutoff } from '../../domain/jobs/schedule.ts'
import type { TimedObservation } from '../../domain/jobs/aggregate.ts'

const DB_FILENAME = 'jobs.sqlite'
const DEFAULT_DB_DIR = '.ai-advent-challenge'
const MAX_RUNS_PER_SCHEDULE = 5000

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'weather',
  city TEXT NOT NULL,
  interval_minutes INTEGER NOT NULL,
  window_hours INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  next_run_at TEXT NOT NULL,
  last_run_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL,
  ran_at TEXT NOT NULL,
  observed_at TEXT,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  value_json TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  value_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_schedule ON runs(schedule_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_runs_ran ON runs(ran_at);
CREATE INDEX IF NOT EXISTS idx_summaries_schedule ON summaries(schedule_id, period_end);
`

type ScheduleRow = {
  id: number
  kind: string
  city: string
  interval_minutes: number
  window_hours: number
  enabled: number
  next_run_at: string
  last_run_at: string | null
  created_at: string
  created_by: string | null
}

type RunRow = {
  id: number
  schedule_id: number
  ran_at: string
  observed_at: string | null
  status: string
  source: string
  value_json: string | null
  error: string | null
}

type SummaryRow = {
  id: number
  schedule_id: number
  period_start: string
  period_end: string
  value_json: string
  created_at: string
}

function parseSample(raw: string | null): WeatherSample | null {
  if (!raw) {
    return null
  }
  try {
    const value = JSON.parse(raw) as WeatherSample
    return value && typeof value.temperatureC === 'number' ? value : null
  } catch {
    return null
  }
}

function toSchedule(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    kind: WEATHER_KIND,
    city: row.city,
    intervalMinutes: row.interval_minutes,
    windowHours: row.window_hours,
    enabled: row.enabled === 1,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }
}

function toRun(row: RunRow): RunRecord {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    ranAt: row.ran_at,
    observedAt: row.observed_at,
    status: row.status as RunStatus,
    source: row.source as RunSource,
    value: parseSample(row.value_json),
    error: row.error,
  }
}

function toSummary(row: SummaryRow): Summary {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    value: JSON.parse(row.value_json) as SummaryValue,
    createdAt: row.created_at,
  }
}

async function resolveDbPath(): Promise<string> {
  const nodePath = await import('node:path')
  const override = process.env.JOBS_DB_PATH?.trim()
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

export type JobsStore = {
  listSchedules(): Schedule[]
  getSchedule(id: number): Schedule | null
  countSchedules(): number
  findScheduleByCity(city: string): Schedule | null
  insertSchedule(input: {
    city: string
    intervalMinutes: number
    windowHours: number
    nextRunAt: string
    createdAt: string
    createdBy: string | null
  }): Schedule
  disableSchedule(id: number): boolean
  markRun(id: number, lastRunAt: string, nextRunAt: string): void
  listDueSchedules(now: Date): Schedule[]
  insertRun(input: {
    scheduleId: number
    ranAt: string
    observedAt: string | null
    status: RunStatus
    source: RunSource
    value: WeatherSample | null
    error: string | null
  }): void
  listRuns(scheduleId: number, limit: number): RunRecord[]
  listRecentRuns(limit: number): RunRecord[]
  listCityObservations(city: string, sinceIso: string | null): TimedObservation[]
  latestRun(scheduleId: number): RunRecord | null
  insertSummary(input: {
    scheduleId: number
    periodStart: string
    periodEnd: string
    value: SummaryValue
    createdAt: string
  }): void
  latestSummary(scheduleId: number): Summary | null
  getMeta(key: string): string | null
  setMeta(key: string, value: string): void
  pruneRuns(now: Date): void
  close(): void
}

export async function createJobsDb(pathOverride?: string): Promise<JobsStore> {
  const { DatabaseSync } = await import('node:sqlite')
  const nodePath = await import('node:path')
  const { mkdir, chmod } = await import('node:fs/promises')
  const dbPath = pathOverride
    ? nodePath.resolve(pathOverride)
    : await resolveDbPath()
  await mkdir(nodePath.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec(SCHEMA_SQL)
  try {
    await chmod(dbPath, 0o600)
  } catch {
    // best-effort permissions; ignore on filesystems without chmod
  }

  return {
    listSchedules() {
      const rows = db
        .prepare('SELECT * FROM schedules ORDER BY created_at ASC, id ASC')
        .all() as ScheduleRow[]
      return rows.map(toSchedule)
    },
    getSchedule(id) {
      const row = db
        .prepare('SELECT * FROM schedules WHERE id = ?')
        .get(id) as ScheduleRow | undefined
      return row ? toSchedule(row) : null
    },
    countSchedules() {
      const row = db
        .prepare('SELECT COUNT(*) AS count FROM schedules WHERE enabled = 1')
        .get() as { count: number }
      return row.count
    },
    findScheduleByCity(city) {
      const row = db
        .prepare(
          'SELECT * FROM schedules WHERE city = ? AND enabled = 1 ORDER BY created_at ASC, id ASC LIMIT 1',
        )
        .get(city) as ScheduleRow | undefined
      return row ? toSchedule(row) : null
    },
    insertSchedule(input) {
      const result = db
        .prepare(
          `INSERT INTO schedules
             (kind, city, interval_minutes, window_hours, enabled, next_run_at, last_run_at, created_at, created_by)
           VALUES (?, ?, ?, ?, 1, ?, NULL, ?, ?)`,
        )
        .run(
          WEATHER_KIND,
          input.city,
          input.intervalMinutes,
          input.windowHours,
          input.nextRunAt,
          input.createdAt,
          input.createdBy,
        )
      const id = Number(result.lastInsertRowid)
      const row = db
        .prepare('SELECT * FROM schedules WHERE id = ?')
        .get(id) as ScheduleRow
      return toSchedule(row)
    },
    disableSchedule(id) {
      const result = db
        .prepare('UPDATE schedules SET enabled = 0 WHERE id = ? AND enabled = 1')
        .run(id)
      return result.changes > 0
    },
    markRun(id, lastRunAt, nextRunAt) {
      db.prepare(
        'UPDATE schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?',
      ).run(lastRunAt, nextRunAt, id)
    },
    listDueSchedules(now) {
      const rows = db
        .prepare(
          'SELECT * FROM schedules WHERE enabled = 1 AND next_run_at <= ? ORDER BY next_run_at ASC',
        )
        .all(now.toISOString()) as ScheduleRow[]
      return rows.map(toSchedule)
    },
    insertRun(input) {
      db.prepare(
        `INSERT INTO runs
           (schedule_id, ran_at, observed_at, status, source, value_json, error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        input.scheduleId,
        input.ranAt,
        input.observedAt,
        input.status,
        input.source,
        input.value ? JSON.stringify(input.value) : null,
        input.error,
      )
    },
    listRuns(scheduleId, limit) {
      const rows = db
        .prepare(
          'SELECT * FROM runs WHERE schedule_id = ? ORDER BY COALESCE(observed_at, ran_at) DESC, id DESC LIMIT ?',
        )
        .all(scheduleId, limit) as RunRow[]
      return rows.map(toRun)
    },
    listRecentRuns(limit) {
      const rows = db
        .prepare(
          'SELECT * FROM runs ORDER BY ran_at DESC, id DESC LIMIT ?',
        )
        .all(limit) as RunRow[]
      return rows.map(toRun)
    },
    latestRun(scheduleId) {
      const row = db
        .prepare(
          'SELECT * FROM runs WHERE schedule_id = ? ORDER BY COALESCE(observed_at, ran_at) DESC, id DESC LIMIT 1',
        )
        .get(scheduleId) as RunRow | undefined
      return row ? toRun(row) : null
    },
    listCityObservations(city, sinceIso) {
      const rows = db
        .prepare(
          `SELECT r.schedule_id, r.observed_at, r.value_json, s.interval_minutes
           FROM runs r
           JOIN schedules s ON s.id = r.schedule_id
           WHERE s.city = ? AND r.status = 'ok' AND r.observed_at IS NOT NULL
             AND (? IS NULL OR r.observed_at >= ?)
           ORDER BY r.observed_at DESC`,
        )
        .all(city, sinceIso, sinceIso) as Array<{
        schedule_id: number
        observed_at: string
        value_json: string | null
        interval_minutes: number
      }>
      const observations: TimedObservation[] = []
      for (const row of rows) {
        const sample = parseSample(row.value_json)
        if (!sample) {
          continue
        }
        observations.push({
          scheduleId: row.schedule_id,
          intervalMinutes: row.interval_minutes,
          observation: { ...sample, observedAt: row.observed_at },
        })
      }
      return observations
    },
    insertSummary(input) {
      db.prepare(
        `INSERT INTO summaries (schedule_id, period_start, period_end, value_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(
        input.scheduleId,
        input.periodStart,
        input.periodEnd,
        JSON.stringify(input.value),
        input.createdAt,
      )
    },
    latestSummary(scheduleId) {
      const row = db
        .prepare(
          'SELECT * FROM summaries WHERE schedule_id = ? ORDER BY period_end DESC, id DESC LIMIT 1',
        )
        .get(scheduleId) as SummaryRow | undefined
      return row ? toSummary(row) : null
    },
    getMeta(key) {
      const row = db
        .prepare('SELECT value FROM meta WHERE key = ?')
        .get(key) as { value: string } | undefined
      return row?.value ?? null
    },
    setMeta(key, value) {
      db.prepare(
        'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ).run(key, value)
    },
    pruneRuns(now) {
      db.prepare('DELETE FROM runs WHERE ran_at < ?').run(retentionCutoff(now))
      db.prepare(
        `DELETE FROM runs WHERE id IN (
           SELECT id FROM runs r
           WHERE (SELECT COUNT(*) FROM runs x WHERE x.schedule_id = r.schedule_id AND
                  (x.observed_at > r.observed_at OR (x.observed_at = r.observed_at AND x.id > r.id))) >= ?
         )`,
      ).run(MAX_RUNS_PER_SCHEDULE)
    },
    close() {
      db.close()
    },
  }
}

let singleton: Promise<JobsStore> | null = null

export function getJobsDb(): Promise<JobsStore> {
  if (!singleton) {
    singleton = createJobsDb()
  }
  return singleton
}
