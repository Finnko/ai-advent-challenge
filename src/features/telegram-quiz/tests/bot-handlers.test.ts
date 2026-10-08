import { describe, expect, it, vi } from 'vitest'
import type { Bot, Transformer } from 'grammy'
import type { Update } from 'grammy/types'
import type { LocalLlmStatus } from '@lib/llm'
import { createQuizBot } from '../server/bot.server'
import { createLocalQuestionGenerator } from '../server/generator.server'
import type { QuestionGenerator } from '../server/generator.server'
import type { QuizQuestion } from '../domain/types'

type ApiCall = { method: string; payload: Record<string, unknown> }

const QUESTION: QuizQuestion = {
  question: 'Столица Франции?',
  options: ['Париж', 'Рим', 'Мадрид', 'Берлин'],
  correctIndex: 0,
  explanation: 'Париж — столица Франции.',
}

const REPEATED: QuizQuestion = {
  question:
    'Какой из следующих видов спорта включает в себя этапы, проводимые в различных странах, и является частью «Лиги наций»?',
  options: ['Формула 1', 'Теннис', 'Баскетбол', 'Лыжные гонки'],
  correctIndex: 0,
  explanation: 'Формула 1 включает этапы, проводимые в различных странах.',
}

const FRESH: QuizQuestion = {
  question: 'Сколько игроков одной команды находятся на поле в футболе?',
  options: ['9', '10', '11', '12'],
  correctIndex: 2,
  explanation: 'В футболе на поле от одной команды 11 игроков.',
}

const AVAILABLE: LocalLlmStatus = {
  available: true,
  baseUrl: 'http://127.0.0.1:8080/v1',
  model: 'test-model',
  servedModels: [],
  error: null,
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function messageUpdate(
  updateId: number,
  chatId: number,
  userId: number,
  text: string,
): Update {
  const commandLength = text.startsWith('/')
    ? (text.split(' ')[0]?.length ?? text.length)
    : 0
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: nowSeconds(),
      chat: { id: chatId, type: 'private', first_name: 'Tester' },
      from: { id: userId, is_bot: false, first_name: 'Tester' },
      text,
      ...(commandLength > 0
        ? {
            entities: [
              { type: 'bot_command', offset: 0, length: commandLength },
            ],
          }
        : {}),
    },
  }
}

function callbackUpdate(
  updateId: number,
  chatId: number,
  userId: number,
  data: string,
  messageId: number,
): Update {
  return {
    update_id: updateId,
    callback_query: {
      id: `cb-${updateId}`,
      from: { id: userId, is_bot: false, first_name: 'Tester' },
      chat_instance: `ci-${chatId}`,
      message: {
        message_id: messageId,
        date: nowSeconds(),
        chat: { id: chatId, type: 'private', first_name: 'Tester' },
        from: { id: 999, is_bot: true, first_name: 'bot' },
        text: 'previous',
      },
      data,
    },
  }
}

function queueFetch(contents: string[]): typeof fetch {
  let index = 0
  return (async () => {
    const content = contents[Math.min(index, contents.length - 1)]
    index += 1
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
      text: async () => content,
    } as unknown as Response
  }) as unknown as typeof fetch
}

function makeRecorder(bot: Bot): ApiCall[] {
  const calls: ApiCall[] = []
  const transformer: Transformer = async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> })
    return { ok: true, result: undefined as never }
  }
  bot.api.config.use(transformer)
  return calls
}

function makeBot(
  options: {
    generator?: QuestionGenerator
    status?: () => Promise<LocalLlmStatus>
    allowedUserIds?: number[]
    roundSize?: number
  } = {},
) {
  const generator = options.generator ?? (async () => QUESTION)
  const bot = createQuizBot({
    token: '123:TEST',
    allowedUserIds: options.allowedUserIds ?? [],
    generator,
    status: options.status ?? (async () => AVAILABLE),
    roundSize: options.roundSize,
  })
  bot.botInfo = {
    id: 999,
    is_bot: true,
    first_name: 'Test Bot',
    username: 'test_bot',
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  }
  const calls = makeRecorder(bot)
  return { bot, calls, generator }
}

function findCallbackData(calls: ApiCall[], prefix: string): string {
  for (const { method, payload } of calls) {
    if (method !== 'sendMessage') {
      continue
    }
    const markup = payload.reply_markup as
      { inline_keyboard?: { callback_data?: string }[][] } | undefined
    for (const row of markup?.inline_keyboard ?? []) {
      for (const button of row) {
        if (button.callback_data?.startsWith(prefix)) {
          return button.callback_data
        }
      }
    }
  }
  throw new Error(`не найдена кнопка ${prefix}`)
}

function texts(calls: ApiCall[], method: string): string[] {
  return calls
    .filter((call) => call.method === method)
    .map((call) => String(call.payload.text ?? ''))
}

describe('createQuizBot', () => {
  it('проводит раунд и начисляет очко', async () => {
    const { bot, calls } = makeBot({ roundSize: 1 })
    await bot.handleUpdate(messageUpdate(1, 100, 5, '/quiz history'))

    const answerData = findCallbackData(calls, 'ans:')
    const roundId = answerData.split(':')[1]

    await bot.handleUpdate(callbackUpdate(2, 100, 5, answerData, 10))
    expect(
      texts(calls, 'editMessageText').some((text) =>
        text.includes('✅ Верно!'),
      ),
    ).toBe(true)

    await bot.handleUpdate(callbackUpdate(3, 100, 5, `next:${roundId}`, 10))
    expect(
      texts(calls, 'sendMessage').some((text) => text.includes('Счёт: 1 из 1')),
    ).toBe(true)
  })

  it('не начисляет очко за неверный ответ', async () => {
    const { bot, calls } = makeBot({ roundSize: 1 })
    await bot.handleUpdate(messageUpdate(1, 100, 5, '/quiz history'))
    const answerData = findCallbackData(calls, 'ans:')
    const roundId = answerData.split(':')[1]

    await bot.handleUpdate(callbackUpdate(2, 100, 5, `ans:${roundId}:2`, 10))
    expect(
      texts(calls, 'editMessageText').some((text) =>
        text.includes('❌ Неверно'),
      ),
    ).toBe(true)

    await bot.handleUpdate(callbackUpdate(3, 100, 5, `next:${roundId}`, 10))
    expect(
      texts(calls, 'sendMessage').some((text) => text.includes('Счёт: 0 из 1')),
    ).toBe(true)
  })

  it('ограничивает доступ по allow-list', async () => {
    const generator = vi.fn(async () => QUESTION)
    const { bot, calls } = makeBot({ generator, allowedUserIds: [999] })

    await bot.handleUpdate(messageUpdate(1, 100, 5, '/quiz'))

    expect(generator).not.toHaveBeenCalled()
    expect(
      texts(calls, 'sendMessage').some((text) => text.includes('⛔')),
    ).toBe(true)
  })

  it('сообщает, когда локальная модель недоступна', async () => {
    const generator = vi.fn(async () => QUESTION)
    const { bot, calls } = makeBot({
      generator,
      status: async () => ({
        ...AVAILABLE,
        available: false,
        error: 'ECONNREFUSED',
      }),
    })

    await bot.handleUpdate(messageUpdate(1, 100, 5, '/quiz'))

    expect(generator).not.toHaveBeenCalled()
    expect(
      texts(calls, 'sendMessage').some((text) => text.includes('недоступна')),
    ).toBe(true)
  })

  it('переживает ошибку генерации', async () => {
    const generator: QuestionGenerator = async () => {
      throw new Error('boom')
    }
    const { bot, calls } = makeBot({ generator })

    await bot.handleUpdate(messageUpdate(1, 100, 5, '/quiz'))

    expect(
      texts(calls, 'sendMessage').some((text) =>
        text.includes('Не удалось сгенерировать вопрос'),
      ),
    ).toBe(true)
  })

  it('учитывает выбранную сложность', async () => {
    const generator = vi.fn(async () => QUESTION)
    const { bot, calls } = makeBot({ generator, roundSize: 1 })

    await bot.handleUpdate(messageUpdate(1, 100, 5, '/difficulty'))
    const difficultyData = findCallbackData(calls, 'diff:none:hard')
    await bot.handleUpdate(callbackUpdate(2, 100, 5, difficultyData, 10))
    await bot.handleUpdate(messageUpdate(3, 100, 5, '/quiz it'))

    expect(generator).toHaveBeenCalledWith(
      expect.objectContaining({ difficulty: 'hard' }),
    )
  })

  it('не задаёт один и тот же вопрос дважды в раунде', async () => {
    const generator = createLocalQuestionGenerator({
      fetchImpl: queueFetch([
        JSON.stringify(REPEATED),
        JSON.stringify(REPEATED),
        JSON.stringify(FRESH),
      ]),
    })
    const { bot, calls } = makeBot({ generator, roundSize: 2 })

    await bot.handleUpdate(messageUpdate(1, 200, 5, '/quiz sports'))
    const answerData = findCallbackData(calls, 'ans:')
    const roundId = answerData.split(':')[1]
    await bot.handleUpdate(callbackUpdate(2, 200, 5, answerData, 10))
    await bot.handleUpdate(callbackUpdate(3, 200, 5, `next:${roundId}`, 10))

    const questions = texts(calls, 'sendMessage')
      .filter((text) => text.startsWith('Вопрос '))
      .map((text) => text.split('\n\n')[1] ?? '')

    expect(questions).toEqual([REPEATED.question, FRESH.question])
  })
})
