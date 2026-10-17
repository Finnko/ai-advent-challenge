import type { ReviewStatus } from '../types'

export type StatusVariant = 'success' | 'danger' | 'accent' | 'default'

export function reviewStatusVariant(status: ReviewStatus): StatusVariant {
  if (status === 'done') {
    return 'success'
  }
  if (status === 'failed') {
    return 'danger'
  }
  if (status === 'cancelled') {
    return 'default'
  }
  return 'accent'
}
