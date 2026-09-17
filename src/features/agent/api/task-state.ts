import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelTask } from '../functions/cancel-task.functions'
import { getTaskState } from '../functions/get-task-state.functions'
import { pauseTask } from '../functions/pause-task.functions'
import { resumeTask } from '../functions/resume-task.functions'

export const taskStateQueryOptions = (sessionId: number) =>
  queryOptions({
    queryKey: ['task-state', sessionId] as const,
    queryFn: () => getTaskState({ data: { sessionId } }),
    enabled: sessionId > 0,
  })

export function useTaskState(sessionId: number | null) {
  return useQuery(taskStateQueryOptions(sessionId ?? 0))
}

export function usePauseTask() {
  const queryClient = useQueryClient()
  return useMutation({
    onSuccess: (_result, sessionId) => {
      queryClient.invalidateQueries({
        queryKey: taskStateQueryOptions(sessionId).queryKey,
      })
    },
    mutationFn: (sessionId: number) => pauseTask({ data: { sessionId } }),
  })
}

export function useResumeTask() {
  const queryClient = useQueryClient()
  return useMutation({
    onSuccess: (_result, sessionId) => {
      queryClient.invalidateQueries({
        queryKey: taskStateQueryOptions(sessionId).queryKey,
      })
    },
    mutationFn: (sessionId: number) => resumeTask({ data: { sessionId } }),
  })
}

export function useCancelTask() {
  const queryClient = useQueryClient()
  return useMutation({
    onSuccess: (_result, sessionId) => {
      queryClient.invalidateQueries({
        queryKey: taskStateQueryOptions(sessionId).queryKey,
      })
    },
    mutationFn: (sessionId: number) => cancelTask({ data: { sessionId } }),
  })
}
