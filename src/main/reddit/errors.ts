export type RedditErrorCode =
  | 'AUTH_REQUIRED'
  | 'BLOCKED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'UNKNOWN'

export class RedditError extends Error {
  override readonly name = 'RedditError'

  constructor(
    readonly code: RedditErrorCode,
    message: string,
    readonly status?: number
  ) {
    super(message)
  }
}

export function isRedditError(err: unknown): err is RedditError {
  return err instanceof RedditError
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'Cancelled'
    return err.message
  }
  return String(err)
}
