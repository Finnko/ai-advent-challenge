import {
  buildTaskStateLine,
  formatTaskStateBlock,
  TASK_STATE_BLOCK_TITLE,
  TASK_STATE_PRECEDENCE_LINE,
} from '@lib/task-state/read'
import type { SystemBlock } from '../agent'
import type { TaskState } from '@lib/task-state/types'

export function buildTaskStateBlocks(state: TaskState | null): SystemBlock[] {
  if (!state) {
    return []
  }
  return [{ kind: 'task-state' as const, content: formatTaskStateBlock(state) }]
}

export {
  buildTaskStateLine,
  formatTaskStateBlock,
  TASK_STATE_BLOCK_TITLE,
  TASK_STATE_PRECEDENCE_LINE,
}
