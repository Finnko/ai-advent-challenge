import { Bot, InlineKeyboard } from 'grammy'
import type { Context } from 'grammy'
import type { LocalLlmStatus } from '@lib/llm'
import { getLocalLlmStatus } from '@lib/local-llm.server'
import {
  advance,
  createRound,
  DEFAULT_ROUND_SIZE,
  EXTEND_SIZE,
  extend,
  finish,
  submitAnswer,
  withQuestion,
} from '../domain/round'
import { RoundStore } from '../domain/store'
import type { Difficulty, RoundState } from '../domain/types'
import { DIFFICULTY_LABELS, resolveTopic } from '../data/topics'
import type { QuestionGenerator } from './generator.server'

const ANSWER_PREFIX = 'ans'
const NEXT_PREFIX = 'next'
const AGAIN_PREFIX = 'again'
const DIFFICULTY_PREFIX = 'diff'
const NO_ROUND_ID = 'none'

export type QuizBotDeps = {
  token: string
  allowedUserIds: number[]
  generator: QuestionGenerator
  store?: RoundStore
  status?: () => Promise<LocalLlmStatus>
  roundSize?: number
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function parseDifficulty(value: string): Difficulty | null {
  return value === 'easy' || value === 'medium' || value === 'hard'
    ? value
    : null
}

export function createQuizBot(deps: QuizBotDeps): Bot {
  const bot = new Bot(deps.token)
  const store = deps.store ?? new RoundStore()
  const roundSize = deps.roundSize ?? DEFAULT_ROUND_SIZE
  const checkStatus = deps.status ?? (() => getLocalLlmStatus())
  const difficultyByChat = new Map<number, Difficulty>()

  const difficultyFor = (chatId: number): Difficulty =>
    difficultyByChat.get(chatId) ?? 'medium'

  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id
    if (
      deps.allowedUserIds.length > 0 &&
      (userId === undefined || !deps.allowedUserIds.includes(userId))
    ) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: 'Доступ ограничен.' })
      } else {
        await ctx.reply('⛔ Доступ к боту ограничен.')
      }
      return
    }
    await next()
  })

  function renderQuestion(state: RoundState): string {
    const header = `Вопрос ${state.questionIndex + 1}/${state.totalQuestions} · ${state.topic.label}`
    return state.current ? `${header}\n\n${state.current.question}` : header
  }

  function questionKeyboard(state: RoundState): InlineKeyboard {
    const keyboard = new InlineKeyboard()
    state.current?.options.forEach((option, index) => {
      keyboard
        .text(
          `${index + 1}. ${option}`,
          `${ANSWER_PREFIX}:${state.roundId}:${index}`,
        )
        .row()
    })
    return keyboard
  }

  async function sendQuestionFor(ctx: Context, chatId: number): Promise<void> {
    const state = store.get(chatId)
    if (!state || state.phase !== 'loading') {
      return
    }
    await ctx.replyWithChatAction('typing').catch(() => undefined)
    try {
      const question = await deps.generator({
        topic: state.topic,
        difficulty: state.difficulty,
        avoid: state.askedQuestions,
      })
      const next = store.set(withQuestion(state, question))
      await ctx.reply(renderQuestion(next), {
        reply_markup: questionKeyboard(next),
      })
    } catch (error) {
      store.delete(chatId)
      await ctx.reply(`Не удалось сгенерировать вопрос: ${describe(error)}`)
    }
  }

  async function startRound(ctx: Context, topicInput?: string): Promise<void> {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      return
    }
    const status = await checkStatus()
    if (!status.available) {
      await ctx.reply(
        `Локальная модель недоступна (${status.error ?? 'нет ответа'}). Запусти mlx_lm.server и проверь LOCAL_LLM_BASE_URL.`,
      )
      return
    }
    const topic = resolveTopic(topicInput)
    const state = createRound({
      chatId,
      roundId: crypto.randomUUID(),
      topic,
      difficulty: difficultyFor(chatId),
      size: roundSize,
    })
    store.set(state)
    await ctx.reply(
      `Викторина: ${topic.label} · ${DIFFICULTY_LABELS[state.difficulty]} · ${state.totalQuestions} вопросов.`,
    )
    await sendQuestionFor(ctx, chatId)
  }

  async function sendSummary(ctx: Context, state: RoundState): Promise<void> {
    const keyboard = new InlineKeyboard().text(
      'Ещё раз',
      `${AGAIN_PREFIX}:${state.roundId}`,
    )
    await ctx.reply(
      `Раунд окончен! Тема: ${state.topic.label}. Счёт: ${state.score} из ${state.totalQuestions}.`,
      { reply_markup: keyboard },
    )
  }

  async function handleAnswer(
    ctx: Context,
    state: RoundState,
    optionIndex: number,
  ): Promise<void> {
    if (state.phase !== 'awaiting' || !state.current) {
      await ctx.answerCallbackQuery({ text: 'Ответ уже принят.' })
      return
    }
    const { state: next, correct } = submitAnswer(state, optionIndex)
    store.set(next)
    const question = next.current
    const correctText = question ? question.options[question.correctIndex] : ''
    const verdict = correct
      ? '✅ Верно!'
      : `❌ Неверно. Правильный ответ: ${correctText}`
    const explanation = question ? `\n\n${question.explanation}` : ''
    const footer = `\n\nСчёт: ${next.score}/${next.questionIndex + 1}`
    await ctx.answerCallbackQuery({ text: correct ? 'Верно!' : 'Неверно' })
    await ctx.editMessageText(
      `${renderQuestion(next)}\n\n${verdict}${explanation}${footer}`,
      {
        reply_markup: new InlineKeyboard().text(
          'Дальше ▶️',
          `${NEXT_PREFIX}:${next.roundId}`,
        ),
      },
    )
  }

  async function handleNext(ctx: Context, state: RoundState): Promise<void> {
    if (state.phase !== 'answered') {
      await ctx.answerCallbackQuery()
      return
    }
    const next = store.set(advance(state))
    await ctx.answerCallbackQuery()
    if (next.phase === 'finished') {
      await sendSummary(ctx, next)
      return
    }
    await sendQuestionFor(ctx, next.chatId)
  }

  bot.command('start', async (ctx) => {
    await ctx.reply(
      [
        'Привет! Я квиз на локальной модели — всё считается на твоей машине, без облака.',
        'Команды:',
        '/quiz [тема] — новый раунд (без темы выберу случайную)',
        '/difficulty — сложность вопросов',
        '/score — текущий счёт',
        '/more — продлить раунд на 5 вопросов',
        '/stop — завершить раунд',
      ].join('\n'),
    )
  })

  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Начни раунд командой /quiz, отвечай кнопками. Сложность — /difficulty, счёт — /score.',
    )
  })

  bot.command('quiz', async (ctx) => {
    const topicInput = ctx.match.trim()
    await startRound(ctx, topicInput || undefined)
  })

  bot.command('difficulty', async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text('Простой', `${DIFFICULTY_PREFIX}:${NO_ROUND_ID}:easy`)
      .text('Средний', `${DIFFICULTY_PREFIX}:${NO_ROUND_ID}:medium`)
      .text('Сложный', `${DIFFICULTY_PREFIX}:${NO_ROUND_ID}:hard`)
    await ctx.reply('Выбери сложность для новых раундов:', {
      reply_markup: keyboard,
    })
  })

  bot.command('score', async (ctx) => {
    const chatId = ctx.chat?.id
    const state = chatId === undefined ? undefined : store.get(chatId)
    if (!state) {
      await ctx.reply('Активного раунда нет. Начни: /quiz')
      return
    }
    await ctx.reply(
      `Счёт: ${state.score} из ${state.totalQuestions} · ${state.topic.label}.`,
    )
  })

  bot.command('stop', async (ctx) => {
    const chatId = ctx.chat?.id
    const state = chatId === undefined ? undefined : store.get(chatId)
    if (!state) {
      await ctx.reply('Активного раунда нет.')
      return
    }
    store.set(finish(state))
    await ctx.reply(`Раунд остановлен. Итоговый счёт: ${state.score}.`)
  })

  bot.command('more', async (ctx) => {
    const chatId = ctx.chat?.id
    const state = chatId === undefined ? undefined : store.get(chatId)
    if (!state || state.phase !== 'finished') {
      await ctx.reply('Продлить можно после завершения раунда. Начни: /quiz')
      return
    }
    const next = store.set(extend(state))
    await ctx.reply(`Продлеваю на ${EXTEND_SIZE}.`)
    await sendQuestionFor(ctx, next.chatId)
  })

  bot.on('callback_query:data', async (ctx) => {
    const [prefix, roundId, value] = ctx.callbackQuery.data.split(':')
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }

    if (prefix === DIFFICULTY_PREFIX) {
      const difficulty = parseDifficulty(value)
      if (!difficulty) {
        await ctx.answerCallbackQuery()
        return
      }
      difficultyByChat.set(chatId, difficulty)
      await ctx.answerCallbackQuery({
        text: `Сложность: ${DIFFICULTY_LABELS[difficulty]}`,
      })
      await ctx.editMessageText(
        `Сложность для новых раундов: ${DIFFICULTY_LABELS[difficulty]}`,
      )
      return
    }

    const state = store.get(chatId)
    if (!state || state.roundId !== roundId) {
      await ctx.answerCallbackQuery({ text: 'Этот раунд устарел.' })
      return
    }

    if (prefix === ANSWER_PREFIX) {
      await handleAnswer(ctx, state, Number(value))
    } else if (prefix === NEXT_PREFIX) {
      await handleNext(ctx, state)
    } else if (prefix === AGAIN_PREFIX) {
      await ctx.answerCallbackQuery()
      await startRound(ctx, state.topic.label)
    } else {
      await ctx.answerCallbackQuery()
    }
  })

  bot.catch((error) => {
    console.error('Ошибка бота:', error.error)
  })

  return bot
}
