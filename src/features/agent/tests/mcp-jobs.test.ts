import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isMutatingTool } from '../domain/agent-tools'
import {
  aggregateSamples,
  nearestObservation,
} from '../domain/jobs/aggregate'
import { validateScheduleInput } from '../domain/jobs/schedule'
import type {
  WeatherObservation,
  WeatherSource,
} from '../domain/jobs/types'
import { createJobsDb } from '../mcp/jobs/db'
import type { JobsStore } from '../mcp/jobs/db'
import { createJobsToolkit } from '../mcp/jobs/tools'
import { mcpServerConfigs } from '../server/mcp-registry.server'

const FIXED_NOW = new Date('2026-09-25T12:00:00.000Z')

function observation(
  observedAt: string,
  temperatureC: number,
  weatherCode = 0,
): WeatherObservation {
  return {
    observedAt,
    temperatureC,
    humidity: 60,
    weatherCode,
    windSpeedKmh: 3,
  }
}

function history(): WeatherObservation[] {
  const points: WeatherObservation[] = []
  for (let hour = 0; hour < 24; hour += 1) {
    points.push(
      observation(
        new Date(FIXED_NOW.getTime() - hour * 60 * 60_000).toISOString(),
        10 + hour,
        hour % 4,
      ),
    )
  }
  return points
}

function fakeWeather(live: WeatherObservation): WeatherSource {
  return {
    async current() {
      return live
    },
    async history() {
      return history()
    },
  }
}

function toolkitFor(store: JobsStore, live: WeatherObservation) {
  return createJobsToolkit({
    store,
    weather: fakeWeather(live),
    now: () => FIXED_NOW,
  })
}

let dir: string
let store: JobsStore

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'jobs-db-'))
  store = await createJobsDb(join(dir, 'jobs.sqlite'))
})

afterAll(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('jobs domain', () => {
  it('валидирует интервал и окно', () => {
    expect(validateScheduleInput(15, 24)).toEqual({
      ok: true,
      intervalMinutes: 15,
      windowHours: 24,
    })
    expect(validateScheduleInput(14, 24).ok).toBe(false)
    expect(validateScheduleInput(60, 0).ok).toBe(false)
    expect(validateScheduleInput('60', '24')).toEqual({
      ok: true,
      intervalMinutes: 60,
      windowHours: 24,
    })
  })

  it('считает агрегаты и ближайший сэмпл', () => {
    const value = aggregateSamples([
      observation('2026-09-25T10:00:00.000Z', 10),
      observation('2026-09-25T11:00:00.000Z', 20),
    ])
    expect(value).not.toBeNull()
    expect(value?.temperature).toEqual({ min: 10, max: 20, avg: 15 })

    const candidates = [
      {
        scheduleId: 7,
        intervalMinutes: 60,
        observation: observation('2026-09-25T11:00:00.000Z', 20),
      },
    ]
    const near = nearestObservation(candidates, '2026-09-25T11:20:00.000Z')
    expect(near?.scheduleId).toBe(7)
    expect(
      nearestObservation(candidates, '2026-09-25T13:00:00.000Z'),
    ).toBeNull()
  })

  it('гейтит только MCP-мутации расписаний', () => {
    expect(isMutatingTool('mcp_schedule_weather_report')).toBe(true)
    expect(isMutatingTool('mcp_cancel_schedule')).toBe(true)
    expect(isMutatingTool('mcp_list_schedules')).toBe(false)
    expect(isMutatingTool('mcp_run_due_jobs')).toBe(false)
  })

  it('скрывает run_due_jobs от агента', () => {
    const jobs = mcpServerConfigs().find((server) => server.kind === 'jobs')
    expect(jobs?.hiddenTools).toContain('run_due_jobs')
  })
})

describe('jobs toolkit', () => {
  it('создаёт расписание и грузит историю за 7 дней', async () => {
    const toolkit = toolkitFor(
      store,
      observation('2026-09-25T12:00:00.000Z', 15),
    )
    const result = await toolkit.scheduleWeatherReport({
      city: 'Москва',
      intervalMinutes: 60,
      windowHours: 24,
    })
    expect(result.ok).toBe(true)
    expect(result.text).toContain('Москва')

    const coverage = store.getMeta('coverage:moscow')
    expect(coverage).not.toBeNull()

    const schedules = store.listSchedules()
    expect(schedules).toHaveLength(1)
    const runs = store.listRuns(schedules[0].id, 100)
    expect(runs.some((run) => run.source === 'bootstrap')).toBe(true)
  })

  it('выполняет готовые задачи и обновляет следующий прогон', async () => {
    const live = observation('2026-09-25T12:00:00.000Z', 21, 61)
    const toolkit = toolkitFor(store, live)
    const result = await toolkit.runDueJobs()
    expect(result.ok).toBe(true)
    expect(result.text).toContain('Прогон завершён')

    const schedule = store.listSchedules()[0]
    expect(schedule.lastRunAt).toBe(live.observedAt)
    expect(Date.parse(schedule.nextRunAt)).toBeGreaterThan(FIXED_NOW.getTime())

    const latest = store.latestRun(schedule.id)
    expect(latest?.status).toBe('ok')
    expect(latest?.source).toBe('live')

    expect(store.latestSummary(schedule.id)).not.toBeNull()
  })

  it('отдаёт сводку и точку, честно сообщает о покрытии', async () => {
    const toolkit = toolkitFor(
      store,
      observation('2026-09-25T12:00:00.000Z', 15),
    )
    const report = await toolkit.getWeatherReport({ city: 'Москва' })
    expect(report.ok).toBe(true)
    expect(report.text).toContain('температура')

    const at = await toolkit.getWeatherAt({
      city: 'Москва',
      datetime: '2026-09-25T11:00:00.000Z',
    })
    expect(at.ok).toBe(true)
    expect(at.text).toContain('Москва')

    const before = await toolkit.getWeatherAt({
      city: 'Москва',
      datetime: '2020-01-01T00:00:00.000Z',
    })
    expect(before.ok).toBe(true)
    expect(before.text).toContain('Покрытие')
  })

  it('list_schedules перечисляет доступные для новых расписаний города', async () => {
    const toolkit = toolkitFor(
      store,
      observation('2026-09-25T12:00:00.000Z', 15),
    )
    const result = await toolkit.listSchedules()
    expect(result.ok).toBe(true)
    expect(result.text).toContain('Санкт-Петербург')
    expect(result.text).toContain('доступные для новых расписаний')
  })

  it('идемпотентно создаёт расписание на город и отменяет', async () => {
    const toolkit = toolkitFor(
      store,
      observation('2026-09-25T12:00:00.000Z', 15),
    )
    const moscow = store.findScheduleByCity('moscow')
    expect(moscow).not.toBeNull()

    const countBefore = store.listSchedules().length
    const again = await toolkit.scheduleWeatherReport({
      city: 'Москва',
      intervalMinutes: 30,
      windowHours: 6,
    })
    expect(again.ok).toBe(true)
    expect(again.text).toContain('уже существует')
    expect(store.listSchedules().length).toBe(countBefore)
    expect(store.findScheduleByCity('moscow')?.id).toBe(moscow?.id)

    const spbFirst = await toolkit.scheduleWeatherReport({
      city: 'Санкт-Петербург',
      intervalMinutes: 120,
      windowHours: 6,
    })
    const spbAgain = await toolkit.scheduleWeatherReport({
      city: 'Санкт-Петербург',
      intervalMinutes: 120,
      windowHours: 6,
    })
    expect(spbFirst.ok).toBe(true)
    expect(spbAgain.ok).toBe(true)
    expect(spbAgain.text).toContain('уже существует')
    expect(store.listSchedules().filter((s) => s.city === 'spb')).toHaveLength(1)

    const cancelled = await toolkit.cancelSchedule({ id: moscow!.id })
    expect(cancelled.ok).toBe(true)
    expect(store.getSchedule(moscow!.id)?.enabled).toBe(false)
  })

  it('идемпотентно открывает схему повторно', async () => {
    const second = await createJobsDb(
      join(dir, 'jobs.sqlite'),
    )
    expect(second.listSchedules().length).toBeGreaterThan(0)
    second.close()
  })
})

describe.runIf(process.env.RUN_NETWORK_TESTS === '1')('Open-Meteo', () => {
  it('отдаёт текущую погоду по Москве', async () => {
    const { createOpenMeteoSource } = await import('../mcp/jobs/weather')
    const source = createOpenMeteoSource()
    const current = await source.current({
      id: 'moscow',
      name: 'Москва',
      latitude: 55.7558,
      longitude: 37.6173,
      timezone: 'Europe/Moscow',
    })
    expect(Number.isFinite(current.temperatureC)).toBe(true)
  }, 20_000)
})
