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
    title: 'Рабочий экран агента',
    description:
      'Единый агент: стратегии контекста, слои памяти и профиль пользователя; заготовки под задачу и инварианты.',
  },
  {
    path: '/rag',
    label: 'RAG',
    title: 'RAG: индексация и ответы',
    description:
      'Чанкинг, эмбеддинги и локальный индекс статей Википедии; поиск, ответы с RAG и без и контрольный набор вопросов.',
  },
  {
    path: '/local-llm',
    label: 'Local LLM',
    title: 'Локальная LLM: запуск и запросы',
    description:
      'Модель Qwen3-8B-4bit на MLX отвечает локально по OpenAI-совместимому API: три пресета разной сложности и свой вопрос.',
  },
] as const
