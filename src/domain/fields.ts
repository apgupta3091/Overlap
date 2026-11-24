// Field rules shared by the creation/response forms, the local service, and the Edge Function.
import { LIMITS } from './limits.ts'

export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function checkName(value: string, max: number = LIMITS.participantNameMax): string | null {
  const v = cleanText(value)
  if (v.length === 0) return 'Enter a name.'
  if (v.length > max) return `Keep it to ${max} characters.`
  return null
}

export function checkTitle(value: string): string | null {
  const v = cleanText(value)
  if (v.length === 0) return 'Give the event a title.'
  if (v.length > LIMITS.titleMax) return `Keep the title to ${LIMITS.titleMax} characters.`
  return null
}

export function checkDescription(value: string): string | null {
  return value.trim().length > LIMITS.descriptionMax ? `Keep the description to ${LIMITS.descriptionMax} characters.` : null
}

/** Empty string means "not set". */
export function checkExpected(value: string): string | null {
  if (value.trim() === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < LIMITS.expectedMin || n > LIMITS.expectedMax) {
    return `Enter a whole number from ${LIMITS.expectedMin} to ${LIMITS.expectedMax}, or leave it blank.`
  }
  return null
}
