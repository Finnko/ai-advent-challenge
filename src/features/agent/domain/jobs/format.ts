import { describeWeatherCode } from './codes.ts'
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

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function sampleText(value: WeatherSample | null): string {
  if (!value) {
    return '—'
  }
  return [
    `${round1(value.temperatureC)} °C`,
    `влажность ${Math.round(value.humidity)}%`,
    `ветер ${round1(value.windSpeedKmh)} км/ч`,
    describeWeatherCode(value.weatherCode),
  ].join(' · ')
}
