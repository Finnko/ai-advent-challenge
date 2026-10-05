export type ScenarioStep = {
  question: string
  expectSources?: string[]
  expectFacts?: string[]
  expectNoData?: boolean
}

export type Scenario = {
  id: string
  title: string
  description: string
  goalKeyword: string
  steps: ScenarioStep[]
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'compare-two-cities',
    title: 'Сравнение Москвы и Санкт-Петербурга',
    description:
      'Длинный диалог сравнения двух городов: население, год основания, климат и follow-up с местоимениями.',
    goalKeyword: 'москв',
    steps: [
      { question: 'Сравни Москву и Санкт-Петербург в целом.' },
      { question: 'Какой из этих двух городов основан раньше?' },
      {
        question: 'В каком году основан каждый из них?',
        expectFacts: ['1147', '1703'],
        expectSources: ['Москва', 'Санкт-Петербург'],
      },
      { question: 'А сколько в них жителей?' },
      { question: 'Какой из них крупнее по населению?' },
      { question: 'Что там за климат?' },
      { question: 'А какой из них ближе к Балтийскому морю?' },
      { question: 'Что ещё известно про его историю?' },
      {
        question: 'Кто основал более молодой из этих городов?',
        expectFacts: ['Пётр'],
        expectSources: ['Санкт-Петербург'],
      },
      { question: 'Есть ли в обоих метро?' },
      { question: 'Напомни, какие два города мы сравниваем.' },
      { question: 'Сформулируй короткий итог сравнения.' },
      { question: 'Что общего между ними?' },
    ],
  },
  {
    id: 'single-city-deep-dive',
    title: 'Погружение в Казань',
    description:
      'Глубокий разбор одного города с точными фактами и вопросами вне корпуса — ассистент обязан честно сказать «нет данных».',
    goalKeyword: 'казан',
    steps: [
      { question: 'Расскажи про Казань.' },
      {
        question: 'Когда она основана?',
        expectFacts: ['1005'],
        expectSources: ['Казань'],
      },
      {
        question: 'Какой символ находится в её кремле?',
        expectFacts: ['Кул-Шариф'],
        expectSources: ['Казань'],
      },
      { question: 'А какая река там протекает?' },
      { question: 'Расскажи про народы, которые там живут.' },
      { question: 'Есть ли в этом городе метро?' },
      { question: 'Сколько там жителей?' },
      { question: 'Какой самый известный спортивный клуб из этого города?' },
      {
        question: 'Назови точный номер телефона приёмной мэрии Казани.',
        expectNoData: true,
      },
      {
        question: 'Какая погода там сегодня?',
        expectNoData: true,
      },
      {
        question:
          'Вернись к теме: перечисли три главных факта о Казани, которые мы обсудили.',
      },
      { question: 'Чем Казань известна в культуре?' },
      { question: 'Сформулируй итог по Казани.' },
    ],
  },
]
