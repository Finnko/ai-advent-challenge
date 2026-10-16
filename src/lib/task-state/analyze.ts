import type { CallLLM, LlmMessage } from '@lib/agent-loop/types'
import type { TaskAnalysis } from './state'
import type { TaskState } from './types'
import { isTaskActor, isTaskStage } from './types'

export type AnalyzeTaskStateInput = {
  current: TaskState | null
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  userMessage: string
}

export type AnalyzerUsage = {
  prompt_tokens: number
  completion_tokens: number
}

export type AnalyzeTaskStateResult = {
  analysis: TaskAnalysis | null
  usage: AnalyzerUsage | null
}

export type AnalyzeTaskState = (
  input: AnalyzeTaskStateInput,
) => Promise<AnalyzeTaskStateResult>

export type AnalyzerOptions = {
  buildMessages: (input: AnalyzeTaskStateInput) => LlmMessage[]
  callLLM: CallLLM
  temperature?: number
  maxTokens?: number
}

export function parseTaskAnalysis(content: string): TaskAnalysis | null {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') {
    return null
  }
  const record = parsed as Record<string, unknown>
  if (!isTaskStage(record.stage)) {
    return null
  }
  const expected =
    record.expectedAction && typeof record.expectedAction === 'object'
      ? (record.expectedAction as Record<string, unknown>)
      : {}
  const steps = Array.isArray(record.steps)
    ? record.steps
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : []
  return {
    title: typeof record.title === 'string' ? record.title : null,
    stage: record.stage,
    step: typeof record.step === 'string' ? record.step : '',
    steps: steps.length > 0 ? steps : undefined,
    requiresTask: record.requiresTask !== false,
    expectedAction: {
      actor: isTaskActor(expected.actor) ? expected.actor : 'agent',
      description:
        typeof expected.description === 'string' ? expected.description : '',
    },
    reason: typeof record.reason === 'string' ? record.reason : null,
  }
}

export function createAnalyzer(options: AnalyzerOptions): AnalyzeTaskState {
  return async (input) => {
    const reply = await options.callLLM({
      messages: options.buildMessages(input),
      temperature: options.temperature ?? 0.2,
      response_format: { type: 'json_object' },
      max_tokens: options.maxTokens ?? 400,
    })
    return {
      analysis: parseTaskAnalysis(reply.content),
      usage: reply.usage,
    }
  }
}
