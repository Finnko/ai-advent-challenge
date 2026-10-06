import type { LocalLlmPreset } from '../types'

export const LOCAL_LLM_PRESETS: LocalLlmPreset[] = [
  {
    id: 'simple',
    label: 'Простой',
    difficulty: 'simple',
    description: 'Один шаг, короткий фактический ответ.',
    prompt: 'Сколько будет 17 × 24? Ответь одним числом, без пояснений.',
  },
  {
    id: 'medium',
    label: 'Средний',
    difficulty: 'medium',
    description: 'Рассуждение на несколько шагов.',
    prompt:
      'В корзине 3 яблока и 2 груши стоят 170 рублей, а 5 яблок и 2 груши — 250 рублей. Сколько стоит одно яблоко? Покажи ход решения.',
  },
  {
    id: 'complex',
    label: 'Сложный',
    difficulty: 'complex',
    description: 'Код плюс объяснение алгоритма.',
    prompt:
      'Напиши на TypeScript функцию, которая принимает массив чисел и целевую сумму и возвращает индексы двух чисел, дающих эту сумму. Объясни алгоритм и его сложность.',
  },
]
