import { describeIssue, type ScheduleIssue } from '../domain/schedule.ts'

export type ServiceErrorCode = 'not_found' | 'invalid' | 'forbidden' | 'limit_reached' | 'conflict' | 'unavailable'

export class ServiceError extends Error {
  readonly code: ServiceErrorCode
  readonly issues: ScheduleIssue[]
  constructor(code: ServiceErrorCode, message: string, issues: ScheduleIssue[] = []) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.issues = issues
  }
}

export function isServiceError(e: unknown, code?: ServiceErrorCode): e is ServiceError {
  return e instanceof ServiceError && (code === undefined || e.code === code)
}

/** A user-facing message for any thrown value. */
export function errorMessage(e: unknown): string {
  if (e instanceof ServiceError) {
    if (e.issues.length > 0) return e.issues.map(describeIssue).join(' ')
    return e.message
  }
  return 'Something went wrong. Please try again.'
}
