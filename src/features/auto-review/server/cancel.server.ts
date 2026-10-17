export class ReviewCancelledError extends Error {
  constructor() {
    super('Проверка прервана пользователем')
    this.name = 'ReviewCancelledError'
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ReviewCancelledError()
  }
}

export function isCancellation(error: unknown, signal?: AbortSignal): boolean {
  return error instanceof ReviewCancelledError || Boolean(signal?.aborted)
}
