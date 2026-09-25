export type City = {
  id: string
  name: string
  latitude: number
  longitude: number
  timezone: string
}

export const CITIES: City[] = [
  {
    id: 'moscow',
    name: 'Москва',
    latitude: 55.7558,
    longitude: 37.6173,
    timezone: 'Europe/Moscow',
  },
  {
    id: 'spb',
    name: 'Санкт-Петербург',
    latitude: 59.9386,
    longitude: 30.3141,
    timezone: 'Europe/Moscow',
  },
]

const ALIASES: Record<string, string> = {
  москва: 'moscow',
  moscow: 'moscow',
  мск: 'moscow',
  спб: 'spb',
  питер: 'spb',
  'санкт петербург': 'spb',
  санкт: 'spb',
  'saint petersburg': 'spb',
  'st petersburg': 'spb',
}

function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function cityNames(): string {
  return CITIES.map((city) => city.name).join(', ')
}

export function findCityById(id: string): City | null {
  return CITIES.find((city) => city.id === id) ?? null
}

export function findCity(input: unknown): City | null {
  if (typeof input !== 'string') {
    return null
  }
  const key = normalize(input)
  if (key.length === 0) {
    return null
  }
  const id = ALIASES[key] ?? key
  return CITIES.find((city) => city.id === id || normalize(city.name) === key) ?? null
}
