import type { City } from '../../domain/jobs/cities.ts'
import { CITIES, cityNames, findCity, findCityById } from '../../domain/jobs/cities.ts'
import {
  aggregateSamples,
  filterByWindow,
  nearestObservation,
} from '../../domain/jobs/aggregate.ts'
import { coverageKey, missingDataText } from '../../domain/jobs/coverage.ts'
import { describeWeatherCode } from '../../domain/jobs/codes.ts'
import { computeNextRun, validateScheduleInput } from '../../domain/jobs/schedule.ts'
import {
  BOOTSTRAP_DAYS,
  MAX_SCHEDULES,
  type RunRecord,
  type RunSource,
  type RunStatus,
  type Schedule,
  type SummaryValue,
  type WeatherObservation,
  type WeatherSample,
  type WeatherSource,
} from '../../domain/jobs/types.ts'
import type { JobsStore } from './db.ts'

type Args = Record<string, unknown>

export type JobToolResult =
  | { ok: true; text: string }
  | { ok: false; text: string }

export type JobsToolkitDeps = {
  store: JobsStore
  weather: WeatherSource
  now?: () => Date
}

export type JobsToolkit = {
  scheduleWeatherReport: (args: Args) => Promise<JobToolResult>
  cancelSchedule: (args: Args) => Promise<JobToolResult>
  listSchedules: () => Promise<JobToolResult>
  getWeatherReport: (args: Args) => Promise<JobToolResult>
  getWeatherAt: (args: Args) => Promise<JobToolResult>
  runDueJobs: () => Promise<JobToolResult>
}

function ok(text: string): JobToolResult {
  return { ok: true, text }
}

function fail(text: string): JobToolResult {
  return { ok: false, text }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function toSample(observation: WeatherObservation): WeatherSample {
  return {
    temperatureC: observation.temperatureC,
    humidity: observation.humidity,
    weatherCode: observation.weatherCode,
    windSpeedKmh: observation.windSpeedKmh,
  }
}

function sampleLine(sample: WeatherSample, observedAt?: string): string {
  const parts = [
    `${round1(sample.temperatureC)} °C`,
    `влажность ${Math.round(sample.humidity)}%`,
    `ветер ${round1(sample.windSpeedKmh)} км/ч`,
    describeWeatherCode(sample.weatherCode),
  ]
  const prefix = observedAt ? `${observedAt}: ` : ''
  return `${prefix}${parts.join(', ')}`
}

function formatSummary(
  city: City,
  windowHours: number,
  value: SummaryValue,
): string {
  const r = (n: number) => round1(n)
  return [
    `${city.name} за последние ${windowHours} ч (${value.samples} сэмплов):`,
    `- температура: мин ${r(value.temperature.min)} / сред. ${r(value.temperature.avg)} / макс ${r(value.temperature.max)} °C`,
    `- влажность: мин ${r(value.humidity.min)} / сред. ${r(value.humidity.avg)} / макс ${r(value.humidity.max)} %`,
    `- ветер: мин ${r(value.wind.min)} / сред. ${r(value.wind.avg)} / макс ${r(value.wind.max)} км/ч`,
  ].join('\n')
}

function formatLastRun(run: RunRecord | null): string {
  if (!run) {
    return '—'
  }
  if (run.value && run.observedAt) {
    return `${run.observedAt} — ${sampleLine(run.value)}`
  }
  if (run.error) {
    return `ошибка: ${run.error}`
  }
  return '—'
}

function formatSchedule(store: JobsStore, schedule: Schedule): string {
  const city = findCityById(schedule.city)
  const name = city?.name ?? schedule.city
  const coverage = store.getMeta(coverageKey(schedule.city)) ?? '—'
  const last = formatLastRun(store.latestRun(schedule.id))
  return [
    `#${schedule.id} ${name} · каждые ${schedule.intervalMinutes} мин · окно ${schedule.windowHours} ч`,
    `  последний прогон: ${last}`,
    `  следующий: ${schedule.nextRunAt} · покрытие с ${coverage}`,
  ].join('\n')
}

function normalizeDatetime(input: unknown): string | null {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return null
  }
  const raw = input.trim().replace(' ', 'T')
  const parsed = Date.parse(raw)
  if (Number.isNaN(parsed)) {
    return null
  }
  return new Date(parsed).toISOString()
}

function record(
  store: JobsStore,
  input: {
    scheduleId: number
    ranAt: string
    observedAt: string | null
    status: RunStatus
    source: RunSource
    value: WeatherSample | null
    error: string | null
  },
): void {
  store.insertRun(input)
}

export function createJobsToolkit(deps: JobsToolkitDeps): JobsToolkit {
  const now = deps.now ?? (() => new Date())
  const store = deps.store

  async function ensureBootstrap(
    city: City,
    scheduleId: number,
  ): Promise<string> {
    const key = coverageKey(city.id)
    if (store.getMeta(key)) {
      return ''
    }
    const observations = await deps.weather.history(city, BOOTSTRAP_DAYS)
    if (observations.length === 0) {
      return ' История пока не загружена.'
    }
    const sorted = [...observations].sort((left, right) =>
      left.observedAt.localeCompare(right.observedAt),
    )
    for (const observation of sorted) {
      record(store, {
        scheduleId,
        ranAt: observation.observedAt,
        observedAt: observation.observedAt,
        status: 'ok',
        source: 'bootstrap',
        value: toSample(observation),
        error: null,
      })
    }
    store.setMeta(key, sorted[0].observedAt)
    return ` История за ${BOOTSTRAP_DAYS} дней: ${sorted.length} сэмплов.`
  }

  function windowObservations(
    cityId: string,
    windowHours: number,
    reference: Date,
  ): WeatherObservation[] {
    const from = new Date(
      reference.getTime() - windowHours * 60 * 60_000,
    ).toISOString()
    const to = reference.toISOString()
    return filterByWindow(
      store
        .listCityObservations(cityId, from)
        .map((entry) => entry.observation),
      from,
      to,
    )
  }

  function buildWindowSummary(
    cityId: string,
    windowHours: number,
    reference: Date,
  ): { value: SummaryValue; from: string; to: string } | null {
    const observations = windowObservations(cityId, windowHours, reference)
    const value = aggregateSamples(observations)
    if (!value) {
      return null
    }
    return {
      value,
      from: new Date(
        reference.getTime() - windowHours * 60 * 60_000,
      ).toISOString(),
      to: reference.toISOString(),
    }
  }

  function reportForCity(city: City, requestedWindow: number | null): string {
    const schedule = store.findScheduleByCity(city.id)
    const windowHours = requestedWindow ?? schedule?.windowHours ?? 24
    const reference = now()
    const observations = windowObservations(city.id, windowHours, reference)
    const value = aggregateSamples(observations)
    if (!value) {
      return missingDataText(city, store.getMeta(coverageKey(city.id)))
    }
    return formatSummary(city, windowHours, value)
  }

  function reportCities(): City[] {
    const ids = new Set(store.listSchedules().map((schedule) => schedule.city))
    const cities = [...ids]
      .map((id) => findCityById(id))
      .filter((city): city is City => city !== null)
    return cities.length > 0 ? cities : CITIES
  }

  async function runSchedule(schedule: Schedule, reference: Date): Promise<string> {
    const city = findCityById(schedule.city)
    const ranAt = reference.toISOString()
    if (!city) {
      record(store, {
        scheduleId: schedule.id,
        ranAt,
        observedAt: null,
        status: 'error',
        source: 'live',
        value: null,
        error: `Неизвестный город: ${schedule.city}`,
      })
      store.markRun(
        schedule.id,
        ranAt,
        computeNextRun(reference, schedule.intervalMinutes),
      )
      return `#${schedule.id}: ошибка — неизвестный город ${schedule.city}.`
    }
    try {
      const observation = await deps.weather.current(city)
      record(store, {
        scheduleId: schedule.id,
        ranAt,
        observedAt: observation.observedAt,
        status: 'ok',
        source: 'live',
        value: toSample(observation),
        error: null,
      })
      store.markRun(
        schedule.id,
        observation.observedAt,
        computeNextRun(reference, schedule.intervalMinutes),
      )
      const summary = buildWindowSummary(city.id, schedule.windowHours, reference)
      if (summary) {
        store.insertSummary({
          scheduleId: schedule.id,
          periodStart: summary.from,
          periodEnd: summary.to,
          value: summary.value,
          createdAt: ranAt,
        })
      }
      return `#${schedule.id} ${city.name}: ${sampleLine(observation)}.`
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      record(store, {
        scheduleId: schedule.id,
        ranAt,
        observedAt: null,
        status: 'error',
        source: 'live',
        value: null,
        error: message,
      })
      store.markRun(
        schedule.id,
        ranAt,
        computeNextRun(reference, schedule.intervalMinutes),
      )
      return `#${schedule.id} ${city.name}: ошибка — ${message}.`
    }
  }

  return {
    async scheduleWeatherReport(args) {
      const city = findCity(args.city)
      if (!city) {
        return fail(`Неизвестный город. Доступны: ${cityNames()}.`)
      }
      const input = validateScheduleInput(args.intervalMinutes, args.windowHours)
      if (!input.ok) {
        return fail(input.error)
      }
      const existing = store.findScheduleByCity(city.id)
      if (existing) {
        return ok(
          `Расписание #${existing.id} для города ${city.name} уже существует: ` +
            `каждые ${existing.intervalMinutes} мин, окно ${existing.windowHours} ч. ` +
            `Повторное создание не требуется — сбор идёт по ближайшему тику.`,
        )
      }
      if (store.countSchedules() >= MAX_SCHEDULES) {
        return fail(
          `Достигнут лимит ${MAX_SCHEDULES} расписаний. Сначала отмени лишние через cancel_schedule.`,
        )
      }
      const reference = now()
      const schedule = store.insertSchedule({
        city: city.id,
        intervalMinutes: input.intervalMinutes,
        windowHours: input.windowHours,
        nextRunAt: reference.toISOString(),
        createdAt: reference.toISOString(),
        createdBy: typeof args.createdBy === 'string' ? args.createdBy : null,
      })
      let note = ''
      try {
        note = await ensureBootstrap(city, schedule.id)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        note = ` Историю загрузить не удалось: ${message}`
      }
      return ok(
        `Расписание #${schedule.id}: ${city.name}, каждые ${input.intervalMinutes} мин, окно ${input.windowHours} ч.${note} Первый живой прогон — по ближайшему тику.`,
      )
    },

    async cancelSchedule(args) {
      const id = Number(args.id)
      if (!Number.isInteger(id) || id <= 0) {
        return fail('id расписания должен быть положительным числом.')
      }
      const schedule = store.getSchedule(id)
      if (!schedule) {
        return fail(`Расписание #${id} не найдено.`)
      }
      if (!schedule.enabled) {
        return ok(`Расписание #${id} уже отменено.`)
      }
      store.disableSchedule(id)
      const city = findCityById(schedule.city)
      return ok(`Расписание #${id} (${city?.name ?? schedule.city}) отменено.`)
    },

    async listSchedules() {
      const available =
        `Города, доступные для новых расписаний: ${cityNames()}. ` +
        'Наличие расписания не требуется — новый город добавляется вызовом schedule_weather_report.'
      const schedules = store.listSchedules()
      if (schedules.length === 0) {
        return ok(`Расписаний нет. ${available}`)
      }
      const lines = schedules.map((schedule) => formatSchedule(store, schedule))
      const coverage = reportCities()
        .map(
          (city) =>
            `${city.name}: покрытие с ${store.getMeta(coverageKey(city.id)) ?? '—'}`,
        )
        .join('; ')
      return ok([...lines, `Покрытие: ${coverage}`, available].join('\n'))
    },

    async getWeatherReport(args) {
      const requested = args.city === undefined || args.city === '' ? null : args.city
      let cities: City[]
      if (requested === null) {
        cities = reportCities()
      } else {
        const city = findCity(requested)
        if (!city) {
          return fail(`Неизвестный город. Доступны: ${cityNames()}.`)
        }
        cities = [city]
      }
      let windowArg: number | null = null
      if (args.windowHours !== undefined) {
        const parsed = Number(args.windowHours)
        if (!Number.isInteger(parsed) || parsed < 1) {
          return fail('windowHours должен быть целым положительным числом часов.')
        }
        windowArg = parsed
      }
      const blocks = cities.map((city) => reportForCity(city, windowArg))
      return ok(blocks.join('\n\n'))
    },

    async getWeatherAt(args) {
      const city = findCity(args.city)
      if (!city) {
        return fail(`Неизвестный город. Доступны: ${cityNames()}.`)
      }
      const targetIso = normalizeDatetime(args.datetime)
      if (!targetIso) {
        return fail('datetime должен быть датой/временем в формате ISO.')
      }
      const coverage = store.getMeta(coverageKey(city.id))
      const candidates = store.listCityObservations(city.id, null)
      const found = nearestObservation(candidates, targetIso)
      if (!found) {
        return ok(missingDataText(city, coverage))
      }
      return ok(
        `${city.name}, ${sampleLine(found.observation, found.observation.observedAt)} (расписание #${found.scheduleId}).`,
      )
    },

    async runDueJobs() {
      const reference = now()
      const due = store.listDueSchedules(reference)
      if (due.length === 0) {
        return ok('Нет задач, готовых к запуску.')
      }
      const lines: string[] = []
      for (const schedule of due) {
        lines.push(await runSchedule(schedule, reference))
      }
      store.pruneRuns(reference)
      return ok(['Прогон завершён.', ...lines].join('\n'))
    },
  }
}
