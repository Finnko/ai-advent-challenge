import type { ChatUsage } from '@lib/llm'

export type LocalLlmDifficulty = 'simple' | 'medium' | 'complex'

export type LocalLlmPreset = {
  id: LocalLlmDifficulty
  label: string
  difficulty: LocalLlmDifficulty
  description: string
  prompt: string
}

export type LocalLlmAnswer = {
  prompt: string
  content: string
  model: string
  usage: ChatUsage | null
  latencyMs: number
  tokensPerSecond: number | null
}

export type LocalLlmStatus = {
  available: boolean
  baseUrl: string
  model: string
  servedModels: string[]
  error: string | null
}

export type LocalLlmInput = {
  prompt?: string
  presetId?: LocalLlmDifficulty
}
