import { useMutation, useQuery } from '@tanstack/react-query'
import type { AnswerGenerator } from '../types'
import {
  approveFileTaskFn,
  listFileRunsFn,
  startFileTaskFn,
} from '../functions/file-task.functions'

export function useStartFileTask() {
  return useMutation({
    mutationFn: (input: {
      goal: string
      generator: AnswerGenerator
      scenario?: string | null
    }) =>
      startFileTaskFn({
        data: {
          goal: input.goal,
          generator: input.generator,
          scenario: input.scenario ?? null,
        },
      }),
  })
}

export function useApproveFileTask() {
  return useMutation({
    mutationFn: (input: { taskId: number; generator: AnswerGenerator }) =>
      approveFileTaskFn({ data: input }),
  })
}

export function useFileRuns() {
  return useQuery({
    queryKey: ['dev-assistant', 'file-runs'],
    queryFn: () => listFileRunsFn(),
  })
}
