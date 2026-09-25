import type { City } from './cities.ts'

export function coverageKey(cityId: string): string {
  return `coverage:${cityId}`
}

export function missingDataText(
  city: City,
  coverageStart: string | null,
): string {
  if (!coverageStart) {
    return `Данных по городу ${city.name} пока нет: фоновые прогоны ещё не запускались.`
  }
  return `Данных за запрошенный период по городу ${city.name} нет. Покрытие начинается с ${coverageStart}.`
}
