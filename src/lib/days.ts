export const DAYS = [
  {
    path: '/day1',
    label: 'Day 1',
    title: 'Первый вызов LLM',
    description: 'Отправь промпт в DeepSeek и получи текстовый ответ.',
  },
  {
    path: '/day2',
    label: 'Day 2',
    title: 'Формат ответа',
    description: 'Сравни свободный и ограниченный (JSON) ответы.',
  },
  {
    path: '/day3',
    label: 'Day 3',
    title: 'Стратегии промптов',
    description: 'Одна задача решается четырьмя способами — сравни точность.',
  },
  {
    path: '/day4',
    label: 'Day 4',
    title: 'Температура',
    description:
      'Один запрос с temperature 0 / 0.7 / 1.2 — сравни точность и креативность.',
  },
  {
    path: '/day5',
    label: 'Day 5',
    title: 'Версии моделей',
    description:
      'Один бриф у трёх моделей разного уровня — каждая сама предлагает архитектуру.',
  },
  {
    path: '/day6',
    label: 'Day 6',
    title: 'Первый агент',
    description:
      'Агент как сущность: input/output policy, инструменты и судьи. Роль — из токена.',
  },
] as const
