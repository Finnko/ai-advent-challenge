export function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export type StatusSource = {
  isError: boolean
  isPending: boolean
  error: unknown
}

export function firstError(sources: StatusSource[]): string | null {
  const failed = sources.find((source) => source.isError)
  return failed ? toError(failed.error) : null
}

export function anyPending(sources: StatusSource[]): boolean {
  return sources.some((source) => source.isPending)
}
