import type { ChatResult } from '@lib/llm'

export type Answer = {
  content: string
  usage: ChatResult['usage']
  model: ChatResult['model']
  latencyMs: ChatResult['latencyMs']
  chars: number
  words: number
}

export type CardState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; answer: Answer; savedPath: string | null; runId: string }
  | { status: 'error'; error: string }

export type BriefState =
  | { status: 'loading' }
  | { status: 'ready'; text: string }
  | { status: 'error'; error: string }
