export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

export type Topic = {
  id: string
  label: string
  prompt: string
}

export type QuizQuestion = {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export type RoundPhase = 'loading' | 'awaiting' | 'answered' | 'finished'

export type RoundState = {
  chatId: number
  roundId: string
  topic: Topic
  difficulty: Difficulty
  askedQuestions: string[]
  current: QuizQuestion | null
  phase: RoundPhase
  questionIndex: number
  totalQuestions: number
  score: number
  updatedAt: number
}
