import type { LoopTraceStep } from '@lib/agent-loop/types'
import type { TaskState } from '@lib/task-state/types'

export type FileOutcome =
  | {
      kind: 'read'
      answer: string
      trace: LoopTraceStep[]
      model: string | null
      runId: number
      diff?: string
    }
  | { kind: 'plan'; taskId: number; state: TaskState }
  | {
      kind: 'done'
      taskId: number
      answer: string
      trace: LoopTraceStep[]
      diff: string
      touched: string[]
      unfinished: string[]
      notChanged: boolean
      state: TaskState
      model: string | null
      retried: boolean
      runId: number
    }
