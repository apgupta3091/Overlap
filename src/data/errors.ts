// Error translation: every failure surfaced to the UI is an AppError with a human message.
// Raw database messages are never shown to users.

export type AppErrorCode =
  | 'unauthenticated'
  | 'session_expired'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'limit_reached'
  | 'validation'
  | 'offline'
  | 'storage_full'
  | 'upload_failed'
  | 'not_configured'
  | 'unknown'

export class AppError extends Error {
  readonly code: AppErrorCode
  constructor(code: AppErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AppError'
    this.code = code
  }
}

const DEFAULT_MESSAGES: Record<AppErrorCode, string> = {
  unauthenticated: 'Please sign in to continue.',
  session_expired: 'Your session expired. Please sign in again.',
  forbidden: 'You don’t have permission to do that. You may no longer be a member of this board.',
  not_found: 'We couldn’t find that. It may have been deleted.',
  conflict: 'That changed while you were editing. Refresh and try again.',
  limit_reached: 'This board has reached its limit.',
  validation: 'Some information wasn’t valid. Check the form and try again.',
  offline: 'You appear to be offline. Check your connection and try again.',
  storage_full: 'Your browser’s storage is full, so this change couldn’t be saved on this device.',
  upload_failed: 'The photo couldn’t be uploaded. Try again.',
  not_configured: 'Accounts aren’t configured for this copy of Shortlist yet. Try the demo instead.',
  unknown: 'Something went wrong. Please try again.',
}

export function appError(code: AppErrorCode, message?: string, cause?: unknown): AppError {
  return new AppError(code, message ?? DEFAULT_MESSAGES[code], { cause })
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** Shape of PostgREST / Supabase errors we care about. */
interface BackendErrorLike {
  code?: string
  status?: number
  statusCode?: string | number
  message?: string
  name?: string
}

/**
 * Translate an unknown thrown value into an AppError.
 * Custom database exceptions use SQLSTATE codes with a `SL` prefix (see migrations) and
 * carry a safe, user-facing message.
 */
export function toAppError(error: unknown, context?: string): AppError {
  if (error instanceof AppError) return error
  if (isOffline()) return appError('offline')
  const e = (error ?? {}) as BackendErrorLike
  const code = e.code ?? ''
  const status = Number(e.status ?? e.statusCode ?? 0)

  // Our own raised exceptions: messages are written for users.
  if (code === 'SL001') return appError('limit_reached', e.message)
  if (code === 'SL002') return appError('forbidden', e.message)
  if (code === 'SL003') return appError('validation', e.message)
  if (code === 'SL004') return appError('not_found', e.message)

  if (code === 'PGRST301' || code === 'PGRST303' || status === 401) return appError('session_expired')
  if (code === '42501' || status === 403) return appError('forbidden')
  if (code === 'PGRST116' || status === 404) return appError('not_found')
  if (code === '23505') return appError('conflict', 'That already exists.')
  if (code === '23514' || code === '22P02' || code === '23502') return appError('validation')
  if (code === '23503') return appError('not_found')
  if (e.name === 'TypeError' && /fetch/i.test(e.message ?? '')) return appError('offline')
  if (e.name === 'QuotaExceededError') return appError('storage_full')

  return appError('unknown', context ? `${context} Please try again.` : undefined, error)
}

export function errorMessage(error: unknown, context?: string): string {
  return toAppError(error, context).message
}
