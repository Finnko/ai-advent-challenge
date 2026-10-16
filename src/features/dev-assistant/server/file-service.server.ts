import type { AnswerGenerator } from '@lib/rag-engine.types'
import type { FileOutcome } from '../domain/file-outcome'
import type { FileTaskOutcomeView } from '../types'
import { approveFileTask, runFileGoal } from './file-task.server'
import { listFileRuns, type FileRunRecord } from './file-runs.server'
import { askDevAssistant } from './service.server'

export async function startFileTask(input: {
  goal: string
  generator: AnswerGenerator
  scenario: string | null
}): Promise<FileTaskOutcomeView> {
  const outcome = await runFileGoal(input)
  if (outcome.kind === 'docs') {
    const answer = await askDevAssistant({
      question: input.goal,
      generator: input.generator,
    })
    return { kind: 'docs', answer }
  }
  return outcome
}

export async function approveFileTaskRun(input: {
  taskId: number
  generator: AnswerGenerator
}): Promise<FileOutcome> {
  return approveFileTask(input)
}

export async function listFileRunsView(limit = 10): Promise<FileRunRecord[]> {
  return listFileRuns(limit)
}

export type { FileRunRecord }
