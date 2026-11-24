// Unsaved availability edits, kept per event so a reload or accidental close doesn't lose work.
import type { AvailabilityPayload } from '../domain/availability.ts'
import { readJson, writeJson, type KeyValueStore } from './store'

export interface AvailabilityDraft {
  displayName: string
  noneWork: boolean
  availability: AvailabilityPayload
  savedAt: string
}

const key = (publicId: string) => `overlap:draft:${publicId}`

export function loadDraft(store: KeyValueStore, publicId: string): AvailabilityDraft | null {
  const d = readJson<Partial<AvailabilityDraft>>(store, key(publicId))
  if (!d || typeof d !== 'object') return null
  return {
    displayName: typeof d.displayName === 'string' ? d.displayName : '',
    noneWork: d.noneWork === true,
    availability: {
      available: Array.isArray(d.availability?.available) ? d.availability.available.filter((x) => typeof x === 'string') : [],
      preferred: Array.isArray(d.availability?.preferred) ? d.availability.preferred.filter((x) => typeof x === 'string') : [],
    },
    savedAt: typeof d.savedAt === 'string' ? d.savedAt : '',
  }
}

export function saveDraft(store: KeyValueStore, publicId: string, draft: AvailabilityDraft): void {
  writeJson(store, key(publicId), draft)
}

export function clearDraft(store: KeyValueStore, publicId: string): void {
  store.removeItem(key(publicId))
}
