import type { ChatResult } from '@lib/llm'
import type { ExpertId, StrategyId } from '@lib/day3'

export type Answer = {
  content: string
  usage: ChatResult['usage']
  chars: number
  words: number
}

export type ExpertAnswer = { id: ExpertId; label: string; answer: Answer }

export type StrategyResult =
  | { kind: 'answer'; answer: Answer; promptUsed: string }
  | { kind: 'promptcraft'; composed: Answer; final: Answer; promptUsed: string }
  | { kind: 'experts'; experts: ExpertAnswer[]; promptUsed: string }

export type ResultState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: StrategyResult }
  | { status: 'error'; error: string }

export type VerdictShape = {
  summary?: string
  scores?: Partial<Record<StrategyId, number>>
  winner?: string
  why?: string
}

export type VerdictState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; verdict: VerdictShape }
  | { status: 'error'; error: string; raw: string }

export type SentBlock = { label: string; text: string }
