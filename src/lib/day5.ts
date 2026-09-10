import type { Tier } from './chat'

export type TierMeta = {
  id: Tier
  label: string
  model: string
  provider: string
  description: string
}

export const TIERS: TierMeta[] = [
  {
    id: 'weak',
    label: 'Слабая',
    model: 'Qwen/Qwen3-8B',
    provider: 'Hugging Face',
    description:
      'Открытая 8B-модель через HF-роутер: маленькая, быстрая, но слабее в рассуждениях.',
  },
  {
    id: 'medium',
    label: 'Средняя',
    model: 'deepseek-flash',
    provider: 'DeepSeek',
    description:
      'Быстрая модель DeepSeek V4.1 Flash: хороший баланс скорости и качества.',
  },
  {
    id: 'strong',
    label: 'Сильная',
    model: 'deepseek-v4-pro',
    provider: 'DeepSeek',
    description:
      'Старшая модель DeepSeek: максимум качества, медленнее и дороже.',
  },
]

export const DAY5_SYSTEM =
  'Ты — системный архитектор. Прочитай техническое задание ниже и предложи конкретную техническую архитектуру интернет-магазина. Следуй разделу «Задание модели» в конце ТЗ. Если чего-то не хватает — принимай разумные допущения и явно их перечисляй.'

export const COMPARISON_NOTE =
  'Один и тот же бриф ушёл в три модели разного уровня. Сравни качество архитектуры, скорость ответа, количество токенов и стоимость. Успешные ответы сохраняются в md/design/proposals/ — разбор за тобой.'

export const LINKS: { title: string; url: string; note: string }[] = [
  {
    title: 'Qwen/Qwen3-8B — карточка модели',
    url: 'https://huggingface.co/Qwen/Qwen3-8B',
    note: 'слабая ступень, вызов через HF-роутер',
  },
  {
    title: 'DeepSeek API — модели и цены',
    url: 'https://api-docs.deepseek.com/quick_start/pricing',
    note: 'средняя и сильная ступени',
  },
  {
    title: 'Hugging Face Inference Providers',
    url: 'https://huggingface.co/docs/inference-providers/index',
    note: 'как устроен роутер для открытых моделей',
  },
]
