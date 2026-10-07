import { describe, expect, it } from 'vitest'
import {
  advance,
  createRound,
  DEFAULT_ROUND_SIZE,
  extend,
  finish,
  submitAnswer,
  withQuestion,
} from '../domain/round'
import type { QuizQuestion, Topic } from '../domain/types'

const TOPIC: Topic = { id: 'it', label: 'IT', prompt: 'технологии' }

const QUESTION: QuizQuestion = {
  question: 'Что такое HTTP?',
  options: ['Протокол', 'Язык', 'База', 'Формат'],
  correctIndex: 0,
  explanation: 'HTTP — протокол передачи данных.',
}

function newRound(size?: number) {
  return createRound({
    chatId: 1,
    roundId: 'r1',
    topic: TOPIC,
    difficulty: 'medium',
    size,
  })
}

describe('createRound', () => {
  it('стартует в фазе загрузки', () => {
    const state = newRound()
    expect(state.phase).toBe('loading')
    expect(state.totalQuestions).toBe(DEFAULT_ROUND_SIZE)
    expect(state.score).toBe(0)
    expect(state.current).toBeNull()
  })
})

describe('withQuestion', () => {
  it('переводит в ожидание ответа и запоминает вопрос', () => {
    const state = withQuestion(newRound(), QUESTION)
    expect(state.phase).toBe('awaiting')
    expect(state.current).toEqual(QUESTION)
    expect(state.askedQuestions).toEqual([QUESTION.question])
  })
})

describe('submitAnswer', () => {
  it('начисляет очко за верный ответ', () => {
    const state = withQuestion(newRound(), QUESTION)
    const { state: next, correct } = submitAnswer(state, 0)
    expect(correct).toBe(true)
    expect(next.score).toBe(1)
    expect(next.phase).toBe('answered')
  })

  it('не начисляет очко за неверный ответ', () => {
    const state = withQuestion(newRound(), QUESTION)
    const { state: next, correct } = submitAnswer(state, 2)
    expect(correct).toBe(false)
    expect(next.score).toBe(0)
  })

  it('игнорирует повторный ответ', () => {
    const answered = submitAnswer(withQuestion(newRound(), QUESTION), 0).state
    const { state: next, correct } = submitAnswer(answered, 0)
    expect(correct).toBe(false)
    expect(next).toBe(answered)
  })
})

describe('advance', () => {
  it('идёт к следующему вопросу', () => {
    const answered = submitAnswer(withQuestion(newRound(), QUESTION), 0).state
    const next = advance(answered)
    expect(next.questionIndex).toBe(1)
    expect(next.phase).toBe('loading')
    expect(next.current).toBeNull()
  })

  it('завершает раунд на последнем вопросе', () => {
    const state = submitAnswer(withQuestion(newRound(1), QUESTION), 0).state
    const next = advance(state)
    expect(next.phase).toBe('finished')
  })

  it('ничего не делает до ответа', () => {
    const state = withQuestion(newRound(), QUESTION)
    expect(advance(state)).toBe(state)
  })
})

describe('extend', () => {
  it('продлевает завершённый раунд', () => {
    const finished = finish(newRound(1))
    const next = extend(finished)
    expect(next.totalQuestions).toBe(1 + 5)
    expect(next.phase).toBe('loading')
  })
})
