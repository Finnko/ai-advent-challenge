import { describeWeatherCode } from './codes.ts'
import { round1 } from './round.ts'
import type { WeatherSample } from './types.ts'

export function formatMoment(value: string | null): string {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function sampleText(
  value: WeatherSample | null,
  observedAt?: string,
): string {
  if (!value) {
    return '—'
  }
  const parts = [
    `${round1(value.temperatureC)} °C`,
    `влажность ${Math.round(value.humidity)}%`,
    `ветер ${round1(value.windSpeedKmh)} км/ч`,
    describeWeatherCode(value.weatherCode),
  ]
  const prefix = observedAt ? `${observedAt}: ` : ''
  return `${prefix}${parts.join(' · ')}`
}
