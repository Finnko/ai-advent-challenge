import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveReviewFn,
  cancelReviewFn,
  cleanupProjectFn,
  getProjectViewFn,
  listProjectsFn,
  startReviewFn,
} from '../functions/review.functions'

const PROJECTS_KEY = ['auto-review', 'projects']

export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: () => listProjectsFn(),
    refetchInterval: (query) =>
      (query.state.data ?? []).some(
        (project) => project.lastReview?.status === 'running',
      )
        ? 2000
        : false,
  })
}

export function useProjectView(key: string) {
  return useQuery({
    queryKey: ['auto-review', 'project', key],
    queryFn: () => getProjectViewFn({ data: { key } }),
    refetchInterval: (query) =>
      (query.state.data?.reviews ?? []).some(
        (review) => review.status === 'running',
      )
        ? 2000
        : false,
  })
}

export function useStartReview() {
  return useMutation({
    mutationFn: (input: {
      key: string
      zipBase64: string
      sourcePath?: string | null
      resumedFrom?: number | null
    }) =>
      startReviewFn({
        data: {
          key: input.key,
          zipBase64: input.zipBase64,
          sourcePath: input.sourcePath ?? null,
          resumedFrom: input.resumedFrom ?? null,
        },
      }),
  })
}

export function useApproveReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reviewId: number) => approveReviewFn({ data: { reviewId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auto-review'] })
    },
  })
}

export function useCancelReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reviewId: number) => cancelReviewFn({ data: { reviewId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auto-review'] })
    },
  })
}

export function useCleanupProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { key: string; dropHistory: boolean }) =>
      cleanupProjectFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auto-review'] })
    },
  })
}
