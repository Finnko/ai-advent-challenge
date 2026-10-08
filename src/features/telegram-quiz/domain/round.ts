import type { Difficulty, QuizQuestion, RoundState, Topic } from './types'

export const DEFAULT_ROUND_SIZE = 5
export const EXTEND_SIZE = 5

export function createRound(params: {
  chatId: number
  roundId: string
  topic: Topic
  difficulty: Difficulty
  size?: number
}): RoundState {
  return {
    chatId: params.chatId,
    roundId: params.roundId,
    topic: params.topic,
    difficulty: params.difficulty,
    askedQuestions: [],
    current: null,
    phase: 'loading',
    questionIndex: 0,
    totalQuestions: params.size ?? DEFAULT_ROUND_SIZE,
    score: 0,
    updatedAt: Date.now(),
  }
}

export function withQuestion(
  state: RoundState,
  question: QuizQuestion,
): RoundState {
  return {
    ...state,
    current: question,
    phase: 'awaiting',
    askedQuestions: [...state.askedQuestions, question.question],
    updatedAt: Date.now(),
  }
}

export function submitAnswer(
  state: RoundState,
  optionIndex: number,
): { state: RoundState; correct: boolean } {
  if (state.phase !== 'awaiting' || !state.current) {
    return { state, correct: false }
  }
  const correct = optionIndex === state.current.correctIndex
  return {
    state: {
      ...state,
      phase: 'answered',
      score: correct ? state.score + 1 : state.score,
      updatedAt: Date.now(),
    },
    correct,
  }
}

export function advance(state: RoundState): RoundState {
  if (state.phase !== 'answered') {
    return state
  }
  const nextIndex = state.questionIndex + 1
  if (nextIndex >= state.totalQuestions) {
    return { ...state, phase: 'finished', current: null, updatedAt: Date.now() }
  }
  return {
    ...state,
    questionIndex: nextIndex,
    phase: 'loading',
    current: null,
    updatedAt: Date.now(),
  }
}

export function extend(
  state: RoundState,
  by: number = EXTEND_SIZE,
): RoundState {
  return {
    ...state,
    totalQuestions: state.totalQuestions + by,
    phase: 'loading',
    current: null,
    updatedAt: Date.now(),
  }
}

export function finish(state: RoundState): RoundState {
  return { ...state, phase: 'finished', current: null, updatedAt: Date.now() }
}
