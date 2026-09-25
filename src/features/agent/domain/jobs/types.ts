import type { City } from './cities.ts'

export const WEATHER_KIND = 'weather'
export const MIN_INTERVAL_MINUTES = 15
export const MAX_INTERVAL_MINUTES = 1440
export const MIN_WINDOW_HOURS = 1
export const MAX_WINDOW_HOURS = 720
export const MAX_SCHEDULES = 5
export const RUN_RETENTION_DAYS = 30
export const MAX_RUNS_PER_SCHEDULE = 5000
export const MAX_PAYLOAD_BYTES = 2048
export const SCHEMA_VERSION = 1
export const BOOTSTRAP_DAYS = 7

export type WeatherSample = {
  temperatureC: number
  humidity: number
  weatherCode: number
  windSpeedKmh: number
}

export type WeatherObservation = WeatherSample & {
  observedAt: string
}

export type WeatherSource = {
  current(city: City): Promise<WeatherObservation>
  history(city: City, pastDays: number): Promise<WeatherObservation[]>
}

export type Schedule = {
  id: number
  kind: typeof WEATHER_KIND
  city: string
  intervalMinutes: number
  windowHours: number
  enabled: boolean
  nextRunAt: string
  lastRunAt: string | null
  createdAt: string
  createdBy: string | null
}

export type RunStatus = 'ok' | 'error'
export type RunSource = 'live' | 'bootstrap'

export type RunRecord = {
  id: number
  scheduleId: number
  ranAt: string
  observedAt: string | null
  status: RunStatus
  source: RunSource
  value: WeatherSample | null
  error: string | null
}

export type RangeStats = {
  min: number
  max: number
  avg: number
}

export type SummaryValue = {
  samples: number
  temperature: RangeStats
  humidity: RangeStats
  wind: RangeStats
}

export type Summary = {
  id: number
  scheduleId: number
  periodStart: string
  periodEnd: string
  value: SummaryValue
  createdAt: string
}

export type WeatherReport = {
  city: string
  windowHours: number
  from: string
  to: string
  value: SummaryValue
}

export type WeatherAtResult =
  | { ok: true; observation: WeatherObservation; scheduleId: number }
  | { ok: false; reason: 'no-data'; coverageStart: string | null }
  | { ok: false; reason: 'out-of-coverage'; coverageStart: string | null }

export type JobScheduleView = {
  id: number
  city: string
  cityName: string
  intervalMinutes: number
  windowHours: number
  enabled: boolean
  nextRunAt: string
  lastRunAt: string | null
  coverageStart: string | null
}

export type JobRunView = {
  id: number
  scheduleId: number
  city: string
  cityName: string
  ranAt: string
  observedAt: string | null
  status: RunStatus
  source: RunSource
  value: WeatherSample | null
  error: string | null
}

export type JobsOverview = {
  schedules: JobScheduleView[]
  runs: JobRunView[]
}
