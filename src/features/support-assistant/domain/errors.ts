export type SupportErrorCode =
  | 'bad_request'
  | 'unknown_seller'
  | 'unknown_ticket'
  | 'seller_mismatch'
  | 'index_missing'
  | 'warming'
  | 'timeout'
  | 'model_failed'
  | 'mcp_failed'
  | 'too_many_requests'
  | 'busy'

export class SupportError extends Error {
  readonly code: SupportErrorCode
  readonly status: number
  readonly retryAfterSec: number | null

  constructor(
    code: SupportErrorCode,
    message: string,
    status: number,
    retryAfterSec: number | null = null,
  ) {
    super(message)
    this.name = 'SupportError'
    this.code = code
    this.status = status
    this.retryAfterSec = retryAfterSec
  }
}

export function isSupportError(error: unknown): error is SupportError {
  return error instanceof SupportError
}
