export type SpecDefinition = {
  id: string
  title: string
  tzPoint: string
  criterion: string
  browserScope: boolean
}

export const SPECS: SpecDefinition[] = [
  {
    id: 'pages',
    title: '1.1 Страницы приложения',
    tzPoint: '1.1',
    criterion: 'Б1',
    browserScope: true,
  },
  {
    id: 'main-page',
    title: '1.1.1 Главная страница',
    tzPoint: '1.1.1',
    criterion: 'Б1',
    browserScope: true,
  },
  {
    id: 'main-page.list',
    title: '1.1.1.1 Главная страница. Список предложений',
    tzPoint: '1.1.1.1',
    criterion: 'Б1',
    browserScope: true,
  },
  {
    id: 'main-page.map',
    title: '1.1.1.2 Главная страница. Карта',
    tzPoint: '1.1.1.2',
    criterion: 'Б1',
    browserScope: true,
  },
  {
    id: 'offer-page',
    title: '1.1.2 Страница предложения',
    tzPoint: '1.1.2',
    criterion: 'Б1',
    browserScope: true,
  },
  {
    id: 'offer-page.reviews',
    title: '1.1.2.1 Страница предложения. Отзывы',
    tzPoint: '1.1.2.1',
    criterion: 'Б1',
    browserScope: true,
  },
  {
    id: 'offer-page.review-form',
    title: '1.1.2.2 Страница предложения. Форма отзыва',
    tzPoint: '1.1.2.2',
    criterion: 'Б1',
    browserScope: true,
  },
  {
    id: 'login-page',
    title: '1.1.3 Страница Login',
    tzPoint: '1.1.3',
    criterion: 'Б1',
    browserScope: true,
  },
  {
    id: 'favorites-page',
    title: '1.1.4 Favorites',
    tzPoint: '1.1.4',
    criterion: 'Б1',
    browserScope: true,
  },
  {
    id: 'extra',
    title: '3 Дополнительно',
    tzPoint: '3',
    criterion: 'Д1',
    browserScope: false,
  },
]

export const SPECS_BY_ID: ReadonlyMap<string, SpecDefinition> = new Map(
  SPECS.map((spec) => [spec.id, spec]),
)

export function mandatorySpecs(): SpecDefinition[] {
  return SPECS.filter((spec) => spec.criterion === 'Б1')
}

export function optionalSpecs(): SpecDefinition[] {
  return SPECS.filter((spec) => spec.criterion !== 'Б1')
}

export function specIdFromFile(file: string): string | null {
  const name = file.replace(/\\/g, '/').split('/').pop() ?? ''
  const base = name.replace(/\.spec\.tsx?$/, '')
  return SPECS_BY_ID.has(base) ? base : null
}
