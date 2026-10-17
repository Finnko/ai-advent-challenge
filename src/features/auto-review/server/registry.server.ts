import { runReviewPipeline } from './pipeline.server'
import { updateReview } from './store.server'

type ActiveRun = {
  promise: Promise<void>
  controller: AbortController
}

const active = new Map<number, ActiveRun>()

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function launchReview(reviewId: number): void {
  if (active.has(reviewId)) {
    return
  }
  const controller = new AbortController()
  const promise = runReviewPipeline(reviewId, controller.signal)
    .catch(async (error) => {
      if (controller.signal.aborted) {
        return
      }
      await updateReview(reviewId, {
        status: 'failed',
        error: `сбой проверки: ${message(error)}`,
        finishedAt: new Date().toISOString(),
      })
    })
    .finally(() => {
      if (active.get(reviewId)?.controller === controller) {
        active.delete(reviewId)
      }
    })
  active.set(reviewId, { promise, controller })
}

export function cancelActiveRun(reviewId: number): boolean {
  const run = active.get(reviewId)
  if (!run) {
    return false
  }
  run.controller.abort()
  return true
}
