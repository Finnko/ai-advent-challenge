import { describe, expect, it } from 'vitest'
import {
  isCancellation,
  ReviewCancelledError,
  throwIfAborted,
} from '../server/cancel.server'
import { reviewStatusVariant } from '../components/status'
import { REVIEW_STATUS_LABELS } from '../types'

describe('cancel server', () => {
  it('бросает ошибку отмены только для прерванного сигнала', () => {
    const controller = new AbortController()
    expect(() => throwIfAborted(controller.signal)).not.toThrow()
    controller.abort()
    expect(() => throwIfAborted(controller.signal)).toThrow(
      ReviewCancelledError,
    )
    expect(() => throwIfAborted(undefined)).not.toThrow()
  })

  it('распознаёт отмену по ошибке или сигналу', () => {
    const controller = new AbortController()
    expect(isCancellation(new ReviewCancelledError())).toBe(true)
    expect(isCancellation(new Error('boom'))).toBe(false)
    controller.abort()
    expect(isCancellation(new Error('boom'), controller.signal)).toBe(true)
  })
})

describe('review status', () => {
  it('отменённая проверка показывается нейтрально', () => {
    expect(REVIEW_STATUS_LABELS.cancelled).toBe('отменена')
    expect(reviewStatusVariant('cancelled')).toBe('default')
    expect(reviewStatusVariant('done')).toBe('success')
    expect(reviewStatusVariant('failed')).toBe('danger')
    expect(reviewStatusVariant('running')).toBe('accent')
  })
})
