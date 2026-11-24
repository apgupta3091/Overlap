import { createContext, useContext, type ReactNode } from 'react'
import { LocalEventService } from './localService'
import type { EventService } from './service'
import { safeLocalStorage, type KeyValueStore } from './store'

/** Everything the UI needs to talk to "the backend" and remember per-browser state. */
export interface OverlapClient {
  /** Distinguishes query caches (e.g. the demo vs. real events). */
  id: string
  service: EventService
  /** Credentials and drafts. */
  store: KeyValueStore
  /** True while events are saved only in this browser (before the live API exists). */
  localOnly: boolean
  /** True for the demo: nothing is persisted. */
  demo: boolean
}

let defaultClient: OverlapClient | null = null
function getDefaultClient(): OverlapClient {
  if (!defaultClient) {
    const store = safeLocalStorage()
    defaultClient = { id: 'local', service: new LocalEventService(store), store, localOnly: true, demo: false }
  }
  return defaultClient
}

const ClientContext = createContext<OverlapClient | null>(null)

export function ClientProvider({ client, children }: { client: OverlapClient; children: ReactNode }) {
  return <ClientContext.Provider value={client}>{children}</ClientContext.Provider>
}

export function useClient(): OverlapClient {
  return useContext(ClientContext) ?? getDefaultClient()
}
