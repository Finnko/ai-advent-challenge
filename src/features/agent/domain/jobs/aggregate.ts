import type {
  RangeStats,
  SummaryValue,
  WeatherObservation,
} from './types.ts'

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function stats(values: number[]): RangeStats | null {
  if (values.length === 0) {
    return null
  }
  const sum = values.reduce((total, value) => total + value, 0)
  return {
    min: round1(Math.min(...values)),
    max: round1(Math.max(...values)),
    avg: round1(sum / values.length),
  }
}

export function aggregateSamples(
  observations: WeatherObservation[],
): SummaryValue | null {
  const valid = observations.filter((observation) =>
    Number.isFinite(Date.parse(observation.observedAt)),
  )
  if (valid.length === 0) {
    return null
  }
  const temperature = stats(valid.map((item) => item.temperatureC))
  const humidity = stats(valid.map((item) => item.humidity))
  const wind = stats(valid.map((item) => item.windSpeedKmh))
  if (!temperature || !humidity || !wind) {
    return null
  }
  return { samples: valid.length, temperature, humidity, wind }
}

export function filterByWindow(
  observations: WeatherObservation[],
  from: string,
  to: string,
): WeatherObservation[] {
  return observations.filter(
    (observation) => observation.observedAt >= from && observation.observedAt <= to,
  )
}

export type TimedObservation = {
  observation: WeatherObservation
  scheduleId: number
  intervalMinutes: number
}

export function nearestObservation(
  candidates: TimedObservation[],
  targetIso: string,
): { observation: WeatherObservation; scheduleId: number } | null {
  const target = Date.parse(targetIso)
  if (Number.isNaN(target)) {
    return null
  }
  const halfIntervalMs = (intervalMinutes: number) =>
    (intervalMinutes * 60_000) / 2
  let best: TimedObservation | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    if (candidate.observation.observedAt === null) {
      continue
    }
    const distance = Math.abs(
      Date.parse(candidate.observation.observedAt) - target,
    )
    if (Number.isNaN(distance)) {
      continue
    }
    if (distance > halfIntervalMs(candidate.intervalMinutes)) {
      continue
    }
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
    ? { observation: best.observation, scheduleId: best.scheduleId }
    : null
}
