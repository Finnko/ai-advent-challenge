import { createServerFn } from '@tanstack/react-start'
import {
  approveReview,
  cancelReview,
  cleanupProjectSources,
  getProjectView,
  getReviewStatus,
  listProjectSummaries,
  startReview,
} from '../server/service.server'
import {
  parseCleanupInput,
  parseProjectKeyInput,
  parseReviewIdInput,
  parseStartReviewInput,
} from './validation'

export const startReviewFn = createServerFn({ method: 'POST' })
  .validator(parseStartReviewInput)
  .handler(async ({ data }) => startReview(data))

export const approveReviewFn = createServerFn({ method: 'POST' })
  .validator(parseReviewIdInput)
  .handler(async ({ data }) => approveReview(data.reviewId))

export const cancelReviewFn = createServerFn({ method: 'POST' })
  .validator(parseReviewIdInput)
  .handler(async ({ data }) => cancelReview(data.reviewId))

export const listProjectsFn = createServerFn({ method: 'GET' }).handler(
  async () => listProjectSummaries(),
)

export const getProjectViewFn = createServerFn({ method: 'POST' })
  .validator(parseProjectKeyInput)
  .handler(async ({ data }) => getProjectView(data.key))

export const getReviewStatusFn = createServerFn({ method: 'POST' })
  .validator(parseReviewIdInput)
  .handler(async ({ data }) => getReviewStatus(data.reviewId))

export const cleanupProjectFn = createServerFn({ method: 'POST' })
  .validator(parseCleanupInput)
  .handler(async ({ data }) => cleanupProjectSources(data))
