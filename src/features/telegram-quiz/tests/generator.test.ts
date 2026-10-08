import { describe, expect, it } from 'vitest'
import {
  createLocalQuestionGenerator,
  GENERATOR_ATTEMPTS,
  GENERATOR_TEMPERATURE,
} from '../server/generator.server'
import type { QuizQuestion, Topic } from '../domain/types'

const TOPIC: Topic = {
  id: 'sports',
  label: 'Спорт',
  prompt: 'спорт и крупные соревнования',
}

const DUPLICATE: QuizQuestion = {
  question:
    'Какой из следующих видов спорта включает в себя этапы, проводимые в различных странах, и является частью «Лиги наций»?',
  options: ['Формула 1', 'Теннис', 'Баскетбол', 'Лыжные гонки'],
  correctIndex: 0,
  explanation: 'Формула 1 включает этапы, проводимые в различных странах.',
}

const NOVEL: QuizQuestion = {
  question: 'Сколько игроков одной команды находятся на поле в футболе?',
  options: ['9', '10', '11', '12'],
  correctIndex: 2,
  explanation: 'В футболе на поле от одной команды 11 игроков.',
}

const CJK_INFECTED: QuizQuestion = {
  question: 'Кто снял фильм «Семь»?',
  options: ['Дэвид芬奇', 'Джо Данте', 'Дэвид Линч', 'Кристофер Нолан'],
  correctIndex: 0,
  explanation: 'Режиссёр — Дэвид芬奇.',
}

const DEGENERATE: QuizQuestion = {
  question:
    'Какой сериал стал первым сериалом, который получил премию «Эмми» за лучший сериал в категории драма?',
  options: [
    'Сверхъестественное',
    'Сверхъестественное',
    'Сверхъестественное',
    'Сверхъестественное',
  ],
  correctIndex: 0,
  explanation: 'Сверхъестественное.',
}

type RecordedCall = { body: Record<string, unknown> | null }

function chatResponse(content: string): Response {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => content,
  } as unknown as Response
}

function queueFetch(contents: string[]) {
  const calls: RecordedCall[] = []
  let index = 0
  const impl = (async (_url: string, init?: { body?: string }) => {
    calls.push({ body: init?.body ? JSON.parse(init.body) : null })
    const content = contents[Math.min(index, contents.length - 1)]
    index += 1
    return chatResponse(content)
  }) as unknown as typeof fetch
  return { impl, calls, count: () => index }
}

function generate(fetchImpl: typeof fetch, avoid: string[]) {
  const generator = createLocalQuestionGenerator({ fetchImpl })
  return generator({ topic: TOPIC, difficulty: 'medium', avoid })
}

describe('createLocalQuestionGenerator', () => {
  it('регенерирует, когда модель повторяет уже заданный вопрос', async () => {
    const { impl, calls } = queueFetch([
      JSON.stringify(DUPLICATE),
      JSON.stringify(NOVEL),
    ])

    const question = await generate(impl, [DUPLICATE.question])

    expect(question.question).toBe(NOVEL.question)
    expect(calls).toHaveLength(2)
  })

  it('считает повтором формулировку с другой пунктуацией и регистром', async () => {
    const echo: QuizQuestion = {
      ...NOVEL,
      question:
        'какой из следующих видов спорта включает в себя этапы, проводимые в различных странах, и является частью лиги наций',
    }
    const { impl, calls } = queueFetch([
      JSON.stringify(echo),
      JSON.stringify(NOVEL),
    ])

    const question = await generate(impl, [DUPLICATE.question])

    expect(question.question).toBe(NOVEL.question)
    expect(calls).toHaveLength(2)
  })

  it('регенерирует, когда у вопроса одинаковые варианты ответа', async () => {
    const { impl, calls } = queueFetch([
      JSON.stringify(DEGENERATE),
      JSON.stringify(NOVEL),
    ])

    const question = await generate(impl, [])

    expect(question.question).toBe(NOVEL.question)
    expect(calls).toHaveLength(2)
  })

  it('регенерирует вопрос с посторонними символами (CJK)', async () => {
    const { impl, calls } = queueFetch([
      JSON.stringify(CJK_INFECTED),
      JSON.stringify(NOVEL),
    ])

    const question = await generate(impl, [])

    expect(question.question).toBe(NOVEL.question)
    expect(calls).toHaveLength(2)
  })

  it('падает, если все попытки содержат посторонние символы', async () => {
    const { impl, calls } = queueFetch([JSON.stringify(CJK_INFECTED)])

    await expect(generate(impl, [])).rejects.toThrow('посторонние')
    expect(calls).toHaveLength(GENERATOR_ATTEMPTS)
  })

  it('падает, если все попытки дают одинаковые варианты', async () => {
    const { impl, calls } = queueFetch([JSON.stringify(DEGENERATE)])

    await expect(generate(impl, [])).rejects.toThrow('варианты')
    expect(calls).toHaveLength(GENERATOR_ATTEMPTS)
  })

  it('падает, если все попытки повторяют заданный вопрос', async () => {
    const { impl, calls } = queueFetch([JSON.stringify(DUPLICATE)])

    await expect(generate(impl, [DUPLICATE.question])).rejects.toThrow(
      'повторила',
    )
    expect(calls).toHaveLength(GENERATOR_ATTEMPTS)
  })

  it('передаёт высокую температуру и не включает список заданных в промпт', async () => {
    const { impl, calls } = queueFetch([JSON.stringify(NOVEL)])

    await generate(impl, [DUPLICATE.question])

    const body = calls[0].body as {
      temperature?: number
      messages?: { content: string }[]
    }
    expect(body.temperature).toBe(GENERATOR_TEMPERATURE)
    const prompt = body.messages?.map((m) => m.content).join('\n') ?? ''
    expect(prompt).not.toContain(DUPLICATE.question)
  })
})
