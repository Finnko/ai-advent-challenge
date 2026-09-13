export const DAYS = [
  {
    path: '/day1',
    label: 'Base LLM API',
    title: 'Первый вызов LLM',
    description: 'Отправь промпт в DeepSeek и получи текстовый ответ.',
  },
  {
    path: '/day2',
    label: 'Response format',
    title: 'Формат ответа',
    description: 'Сравни свободный и ограниченный (JSON) ответы.',
  },
  {
    path: '/day3',
    label: 'Prompt strategies',
    title: 'Стратегии промптов',
    description: 'Одна задача решается четырьмя способами — сравни точность.',
  },
  {
    path: '/day4',
    label: 'Temperature',
    title: 'Температура',
    description:
      'Один запрос с temperature 0 / 0.7 / 1.2 — сравни точность и креативность.',
  },
  {
    path: '/day5',
    label: 'Model tiers',
    title: 'Версии моделей',
    description:
      'Один бриф у трёх моделей разного уровня — каждая сама предлагает архитектуру.',
  },
  {
    path: '/agent',
    label: 'Agent',
    title: 'Контекст и память',
    description:
      'Агент с памятью и сжатием истории: сводка старого диалога, кеш промпта, A/B экономии.',
  },
] as const
