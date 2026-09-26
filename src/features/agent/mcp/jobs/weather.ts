import type { City } from '../../domain/jobs/cities.ts'
import type {
  WeatherObservation,
  WeatherSource,
} from '../../domain/jobs/types.ts'

const API_URL = 'https://api.open-meteo.com/v1/forecast'
const FIELDS =
  'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m'
const REQUEST_TIMEOUT_MS = 8000

type CurrentResponse = {
  current?: {
    time?: number
    temperature_2m?: number
    relative_humidity_2m?: number
    weather_code?: number
    wind_speed_10m?: number
  }
}

type HourlyResponse = {
  hourly?: {
    time?: number[]
    temperature_2m?: (number | null)[]
    relative_humidity_2m?: (number | null)[]
    weather_code?: (number | null)[]
    wind_speed_10m?: (number | null)[]
  }
}

function toIso(seconds: number | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return null
  }
  return new Date(seconds * 1000).toISOString()
}

function toSample(value: {
  temperature_2m?: number | null
  relative_humidity_2m?: number | null
  weather_code?: number | null
  wind_speed_10m?: number | null
}): WeatherObservation | null {
  const { temperature_2m, relative_humidity_2m, weather_code, wind_speed_10m } =
    value
  if (typeof temperature_2m !== 'number') {
    return null
  }
  return {
    observedAt: '',
    temperatureC: temperature_2m,
    humidity: typeof relative_humidity_2m === 'number' ? relative_humidity_2m : 0,
    weatherCode: typeof weather_code === 'number' ? weather_code : 0,
    windSpeedKmh: typeof wind_speed_10m === 'number' ? wind_speed_10m : 0,
  }
}

export function createOpenMeteoSource(
  fetchImpl: typeof fetch = fetch,
): WeatherSource {
  async function request(params: Record<string, string>): Promise<unknown> {
    const query = new URLSearchParams({
      timezone: 'Europe/Moscow',
      timeformat: 'unixtime',
      wind_speed_unit: 'kmh',
      ...params,
    })
    const response = await fetchImpl(`${API_URL}?${query.toString()}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error(`Open-Meteo ${response.status}`)
    }
    return response.json()
  }

  return {
    async current(city: City) {
      const data = (await request({
        latitude: String(city.latitude),
        longitude: String(city.longitude),
        current: FIELDS,
      })) as CurrentResponse
      const raw = data.current
      const observedAt = toIso(raw?.time)
      const sample = raw ? toSample(raw) : null
      if (!sample || !observedAt) {
        throw new Error('Open-Meteo: пустой ответ current')
      }
      return { ...sample, observedAt }
    },
    async history(city: City, pastDays: number) {
      const data = (await request({
        latitude: String(city.latitude),
        longitude: String(city.longitude),
        hourly: FIELDS,
        past_days: String(pastDays),
        forecast_days: '0',
      })) as HourlyResponse
      const hourly = data.hourly
      if (!hourly?.time || !Array.isArray(hourly.time)) {
        return []
      }
      const observations: WeatherObservation[] = []
      hourly.time.forEach((time, index) => {
        const observedAt = toIso(time)
        const sample = toSample({
          temperature_2m: hourly.temperature_2m?.[index],
          relative_humidity_2m: hourly.relative_humidity_2m?.[index],
          weather_code: hourly.weather_code?.[index],
          wind_speed_10m: hourly.wind_speed_10m?.[index],
        })
        if (observedAt && sample) {
          observations.push({ ...sample, observedAt })
        }
      })
      return observations
    },
  }
}
