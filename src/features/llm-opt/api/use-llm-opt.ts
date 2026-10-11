import { useState } from 'react'
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { SWEEP_CONFIGS } from '../data/configs'
import { getRunsFn, resetRunsFn } from '../functions/results.functions'
import { runExtractionFn } from '../functions/run.functions'
import { llmOptStatusFn } from '../functions/status.functions'

export const llmOptKeys = {
  all: ['llm-opt'] as const,
  status: ['llm-opt', 'status'] as const,
  runs: ['llm-opt', 'runs'] as const,
}

export const llmOptStatusQueryOptions = queryOptions({
  queryKey: llmOptKeys.status,
  queryFn: () => llmOptStatusFn(),
  refetchInterval: 15_000,
})

export function useLlmOptStatus() {
  return useQuery(llmOptStatusQueryOptions)
}

export function useRuns() {
  return useQuery({
    queryKey: llmOptKeys.runs,
    queryFn: () => getRunsFn(),
  })
}

export function useResetRuns() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => resetRunsFn(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: llmOptKeys.runs }),
  })
}

export type SweepProgress = {
  running: boolean
  completed: number
  total: number
  currentLabel: string | null
  error: string | null
}

const INITIAL_PROGRESS: SweepProgress = {
  running: false,
  completed: 0,
  total: 0,
  currentLabel: null,
  error: null,
}

export function useSweepRun() {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<SweepProgress>(INITIAL_PROGRESS)

  const run = async (input: { configIds: string[]; docIds: string[] }) => {
    const configs = SWEEP_CONFIGS.filter((config) =>
      input.configIds.includes(config.id),
    )
    const total = configs.reduce(
      (sum, config) => sum + config.repeats * input.docIds.length,
      0,
    )
    let completed = 0

    try {
      for (const config of configs) {
        for (const docId of input.docIds) {
          for (let repeat = 0; repeat < config.repeats; repeat += 1) {
            const suffix = config.repeats > 1 ? ` · повтор ${repeat + 1}` : ''
            setProgress({
              running: true,
              completed,
              total,
              currentLabel: `${config.label} · ${docId}${suffix}`,
              error: null,
            })
            await runExtractionFn({
              data: { configId: config.id, docId, repeat },
            })
            completed += 1
            setProgress({
              running: true,
              completed,
              total,
              currentLabel: `${config.label} · ${docId}${suffix}`,
              error: null,
            })
          }
        }
      }
      setProgress({ ...INITIAL_PROGRESS, completed: total, total })
    } catch (cause) {
      setProgress((prev) => ({
        ...prev,
        running: false,
        error: cause instanceof Error ? cause.message : String(cause),
      }))
    } finally {
      await queryClient.invalidateQueries({ queryKey: llmOptKeys.runs })
    }
  }

  const reset = () => setProgress(INITIAL_PROGRESS)

  return { ...progress, run, reset }
}
