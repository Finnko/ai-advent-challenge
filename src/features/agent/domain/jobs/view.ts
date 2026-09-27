import { findCityById } from './cities.ts'
import { coverageKey } from './coverage.ts'
import type {
  JobRunView,
  JobScheduleView,
  RunRecord,
  Schedule,
} from './types.ts'

export type ScheduleViewPort = {
  getMeta(key: string): string | null
}

function cityName(id: string): string {
  return findCityById(id)?.name ?? id
}

export function scheduleView(
  port: ScheduleViewPort,
  schedule: Schedule,
): JobScheduleView {
  return {
    id: schedule.id,
    city: schedule.city,
    cityName: cityName(schedule.city),
    intervalMinutes: schedule.intervalMinutes,
    windowHours: schedule.windowHours,
    enabled: schedule.enabled,
    nextRunAt: schedule.nextRunAt,
    lastRunAt: schedule.lastRunAt,
    coverageStart: port.getMeta(coverageKey(schedule.city)),
  }
}

export function runView(run: RunRecord, city: string): JobRunView {
  return {
    id: run.id,
    scheduleId: run.scheduleId,
    city,
    cityName: cityName(city),
    ranAt: run.ranAt,
    observedAt: run.observedAt,
    status: run.status,
    source: run.source,
    value: run.value,
    error: run.error,
  }
}
