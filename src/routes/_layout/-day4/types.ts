import type { ChatResult } from '@lib/llm'
import type { FinalCheck } from '@lib/day4'

export type Source = 'curated' | 'custom'

export type Answer = {
  content: string
  usage: ChatResult['usage']
  model: ChatResult['model']
  chars: number
  words: number
  check: FinalCheck
}

export type TempState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; answer: Answer }
  | { status: 'error'; error: string }

export type LastRun = { source: Source; user: string }
