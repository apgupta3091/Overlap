// Per-event credentials kept in this browser. Chunk 9 revisits storage and recovery.
import { readJson, writeJson, type KeyValueStore } from './store'

export interface EventCredentials {
  adminToken?: string
  responseId?: string
  editToken?: string
}

const key = (publicId: string) => `overlap:cred:${publicId}`

export function getCredentials(store: KeyValueStore, publicId: string): EventCredentials {
  return readJson<EventCredentials>(store, key(publicId)) ?? {}
}

export function updateCredentials(store: KeyValueStore, publicId: string, patch: EventCredentials): EventCredentials {
  const next = { ...getCredentials(store, publicId), ...patch }
  writeJson(store, key(publicId), next)
  return next
}
