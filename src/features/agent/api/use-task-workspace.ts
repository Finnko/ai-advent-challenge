import {
  useApproveTask,
  useCancelTask,
  usePauseTask,
  useResumeTask,
  useTaskState,
} from './task-state'
import { anyPending, firstError } from './workspace-status'

export function useTaskWorkspace(sessionId: number | null) {
  const taskStateQuery = useTaskState(sessionId)
  const pauseTaskMutation = usePauseTask()
  const resumeTaskMutation = useResumeTask()
  const cancelTaskMutation = useCancelTask()
  const approveTaskMutation = useApproveTask()

  const taskMutations = [
    pauseTaskMutation,
    resumeTaskMutation,
    cancelTaskMutation,
    approveTaskMutation,
  ]

  const actions = {
    pauseTask() {
      if (sessionId === null) {
        return
      }
      pauseTaskMutation.mutate(sessionId)
    },
    resumeTask() {
      if (sessionId === null) {
        return
      }
      resumeTaskMutation.mutate(sessionId)
    },
    cancelTask() {
      if (sessionId === null) {
        return
      }
      cancelTaskMutation.mutate(sessionId)
    },
    approveTask() {
      if (sessionId === null) {
        return
      }
      approveTaskMutation.mutate(sessionId)
    },
  }

  return {
    taskState: taskStateQuery.data?.taskState ?? null,
    taskBusy: anyPending(taskMutations),
    taskError: firstError(taskMutations),
    actions,
  }
}
