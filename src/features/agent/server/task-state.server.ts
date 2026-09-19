import {
  cancelTask,
  pauseTask,
  resumeTask,
  transitionEvent,
} from '../domain/task/state'
import type { TaskState } from '../domain/task/types'
import {
  appendMessage,
  getSession,
  getTaskState,
  saveTaskState,
} from './store.server'

export type TaskAction = 'pause' | 'resume' | 'cancel'

const TRANSITIONS: Record<
  TaskAction,
  (state: TaskState, at: string) => TaskState
> = {
  pause: pauseTask,
  resume: resumeTask,
  cancel: cancelTask,
}

async function taskStateFor(sessionId: number): Promise<
  { enabled: true; current: TaskState | null } | { enabled: false }
> {
  const session = await getSession(sessionId)
  if (!session || !session.taskStateEnabled) {
    return { enabled: false }
  }
  return { enabled: true, current: await getTaskState(sessionId) }
}

export async function readSessionTaskState(
  sessionId: number,
): Promise<TaskState | null> {
  const result = await taskStateFor(sessionId)
  return result.enabled ? result.current : null
}

export async function applyTaskAction(
  sessionId: number,
  action: TaskAction,
  at: string = new Date().toISOString(),
): Promise<TaskState | null> {
  const result = await taskStateFor(sessionId)
  if (!result.enabled || !result.current) {
    return null
  }
  const next = TRANSITIONS[action](result.current, at)
  if (next === result.current) {
    return result.current
  }
  await saveTaskState(sessionId, next)
  const transition = next.history.at(-1)
  if (transition && next.history.length > result.current.history.length) {
    await appendMessage(sessionId, 'task', '', transitionEvent(transition))
  }
  return next
}
