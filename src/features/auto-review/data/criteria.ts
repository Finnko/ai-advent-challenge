export type CriterionGroup = 'basic' | 'advanced'

export type CriterionEvaluation = 'playwright' | 'static' | 'model'

export const CRITERION_GROUP_LABELS: Record<CriterionGroup, string> = {
  basic: 'Базовая проверка',
  advanced: 'Дополнительные критерии',
}

export type CriterionDefinition = {
  code: string
  group: CriterionGroup
  section: string
  title: string
  rule: string
  evaluation: CriterionEvaluation
}

export const BASIC_CRITERIA: CriterionDefinition[] = [
  {
    code: 'Б1',
    group: 'basic',
    section: 'Базовая проверка',
    title: 'Код соответствует техническому заданию проекта',
    rule: 'Все обязательные пункты технического задания выполнены.',
    evaluation: 'playwright',
  },
  {
    code: 'Б2',
    group: 'basic',
    section: 'Базовая проверка',
    title: 'При выполнении кода не возникает необработанных ошибок',
    rule: 'При открытии страниц, загрузке данных и работе с сайтом не возникает ошибок, программа не ломается и не зависает. Сообщения о сетевых ошибках в консоли не считаются.',
    evaluation: 'playwright',
  },
  {
    code: 'Б3',
    group: 'basic',
    section: 'Базовая проверка',
    title:
      'Код является кроссбраузерным и не вызывает ошибок в разных браузерах',
    rule: 'Обязательные пункты технического задания работают без ошибок в Chromium и Firefox.',
    evaluation: 'playwright',
  },
]

export const ADVANCED_CRITERIA: CriterionDefinition[] = [
  {
    code: 'Д1',
    group: 'advanced',
    section: 'Работоспособность',
    title: 'Техническое задание реализовано в полном объёме',
    rule: 'Все обязательные и необязательные пункты технического задания выполнены.',
    evaluation: 'model',
  },
  {
    code: 'Д2',
    group: 'advanced',
    section: 'Стиль кода, читаемость, единообразие',
    title: 'Функции-обработчики событий названы через handle',
    rule: 'Имя строится как handle + название объекта + название события, например handleFormSubmit, handleInputChange.',
    evaluation: 'static',
  },
  {
    code: 'Д3',
    group: 'advanced',
    section: 'Стиль кода, читаемость, единообразие',
    title:
      'Составные константы собираются в перечисления (Enum) или константный объект',
    rule: 'Множества однотипных констант собираются в перечисления или константный объект.',
    evaluation: 'model',
  },
  {
    code: 'Д5',
    group: 'advanced',
    section: 'Стиль кода, читаемость, единообразие',
    title: 'В коде не используются магические значения и магические типы',
    rule: 'Под каждое значение заводится переменная, названная как константа. Под тип заводится отдельный псевдоним типа.',
    evaluation: 'model',
  },
  {
    code: 'Д8',
    group: 'advanced',
    section: 'React',
    title: 'Структура каждого TSX-файла соблюдена',
    rule: 'Порядок: импорты, описание типа компонента (props), код компонента. Прочие блоки кода располагаются произвольно.',
    evaluation: 'model',
  },
  {
    code: 'Д9',
    group: 'advanced',
    section: 'React',
    title:
      'Колбэки для обработки событий, переданные в props, названы через on',
    rule: 'Колбэк в props называется с префиксом on, например onClick.',
    evaluation: 'static',
  },
  {
    code: 'Д11',
    group: 'advanced',
    section: 'React',
    title:
      'Все дополнительные ресурсы компонента размещаются в директории с компонентом',
    rule: 'Например, стили компонента лежат рядом с ним, а не централизованно.',
    evaluation: 'static',
  },
  {
    code: 'Д12',
    group: 'advanced',
    section: 'Redux',
    title: 'Для создания Actions используется паттерн Action Creators',
    rule: 'Действия создаются функциями-создателями действий, а не объектами, разбросанными по коду.',
    evaluation: 'model',
  },
  {
    code: 'Д13',
    group: 'advanced',
    section: 'Redux',
    title:
      'Для работы с асинхронными actions используется библиотека redux-thunk',
    rule: 'Асинхронные действия оформляются через redux-thunk.',
    evaluation: 'model',
  },
  {
    code: 'Д14',
    group: 'advanced',
    section: 'Redux',
    title: 'Редьюсер не содержит побочных эффектов',
    rule: 'Функция-редьюсер опирается только на state, action и чистые функции.',
    evaluation: 'model',
  },
  {
    code: 'Д15',
    group: 'advanced',
    section: 'Redux',
    title:
      'Для именования функций-редьюсеров используются только существительные',
    rule: 'Имя редьюсера — существительное, описывающее домен.',
    evaluation: 'model',
  },
  {
    code: 'Д16',
    group: 'advanced',
    section: 'Redux',
    title:
      'Логика изменения состояния описывается в редьюсере, а не в компоненте',
    rule: 'Компонент не мутирует состояние напрямую — изменение описывает редьюсер.',
    evaluation: 'model',
  },
  {
    code: 'Д17',
    group: 'advanced',
    section: 'Redux',
    title: 'Отсутствует универсальный редьюсер',
    rule: 'Редьюсеры разбиваются по предметной области и объединяются через combineReducers.',
    evaluation: 'model',
  },
  {
    code: 'Д18',
    group: 'advanced',
    section: 'Redux',
    title: 'Для чтения состояния применяются селекторы',
    rule: 'Если результат чтения нужно модифицировать, допускается мемоизация (reselect).',
    evaluation: 'model',
  },
  {
    code: 'Д19',
    group: 'advanced',
    section: 'Redux',
    title: 'Для именования типов действия применяется паттерн домен/действие',
    rule: 'Например list/addFavorite, user/login.',
    evaluation: 'static',
  },
  {
    code: 'Д20',
    group: 'advanced',
    section: 'Hooks',
    title:
      'При изменении состояния компонента в useEffect выполняется проверка на демонтирование',
    rule: 'Проверка позволяет избежать обновления состояния после демонтирования компонента.',
    evaluation: 'model',
  },
  {
    code: 'Д21',
    group: 'advanced',
    section: 'Hooks',
    title: 'Кастомные хуки начинаются с префикса use',
    rule: 'Например useUser.',
    evaluation: 'static',
  },
  {
    code: 'Д22',
    group: 'advanced',
    section: 'Корректность кода и тесты',
    title: 'Существуют юнит-тесты на все состояния всех редьюсеров',
    rule: 'Каждый редьюсер покрыт тестами на все свои состояния.',
    evaluation: 'model',
  },
  {
    code: 'Д23',
    group: 'advanced',
    section: 'Корректность кода и тесты',
    title: 'Все компоненты в проекте покрыты тестами',
    rule: 'Для каждого компонента существует тест.',
    evaluation: 'model',
  },
  {
    code: 'Д24',
    group: 'advanced',
    section: 'Корректность кода и тесты',
    title: 'Тестовые файлы лежат рядом с файлами, для которых написан тест',
    rule: 'Все тесты используют в названии расширение *.test.ts.',
    evaluation: 'static',
  },
  {
    code: 'Д27',
    group: 'advanced',
    section: 'Корректность кода и тесты',
    title: 'Во всех видах тестовых файлов используются моковые данные',
    rule: 'Моковые данные описывают только значимые для теста props, остальные не усложняются.',
    evaluation: 'model',
  },
  {
    code: 'Д28',
    group: 'advanced',
    section: 'Корректность кода и тесты',
    title: 'В компонентах отсутствует прямое обращение к DOM-элементам',
    rule: 'Если нужен доступ к DOM-элементу, применяются ссылки (ref), а не document.querySelector.',
    evaluation: 'static',
  },
  {
    code: 'Д29',
    group: 'advanced',
    section: 'Корректность кода и тесты',
    title: 'Глобальный стейт не содержит вычисляемых значений',
    rule: 'Данные, выводимые из состояния, вычисляются в компоненте или селекторе, а не хранятся отдельно.',
    evaluation: 'model',
  },
]

export const CRITERIA: CriterionDefinition[] = [
  ...BASIC_CRITERIA,
  ...ADVANCED_CRITERIA,
]

export const CRITERIA_BY_CODE: ReadonlyMap<string, CriterionDefinition> =
  new Map(CRITERIA.map((criterion) => [criterion.code, criterion]))

export function criterionCodes(): string[] {
  return CRITERIA.map((criterion) => criterion.code)
}
