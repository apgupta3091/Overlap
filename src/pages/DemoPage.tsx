import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { AppShell } from '../app/AppShell'
import { LinkButton } from '../components/ui/Button'
import { ClientProvider, type OverlapClient } from '../data/client'
import { LocalEventService, seedLocalEvent } from '../data/localService'
import { memoryStore } from '../data/store'
import { buildDemoEvent, DEMO_ID } from '../demo/fixtures'
import { EventScreen } from '../features/event/EventScreen'

function createDemoClient(): OverlapClient {
  const store = memoryStore()
  seedLocalEvent(store, buildDemoEvent())
  return { id: `demo-${Math.random().toString(36).slice(2)}`, service: new LocalEventService(store), store, localOnly: true, demo: true }
}

/** A fully interactive event that lives in memory: add yourself, watch the results change, reload to reset. */
export function DemoPage() {
  const [client] = useState(createDemoClient)
  return (
    <AppShell>
      <ClientProvider client={client}>
        <EventScreen
          publicId={DEMO_ID}
          banner={
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
              <p className="inline-flex items-center gap-2">
                <FlaskConical aria-hidden className="size-4 shrink-0" />
                <span>
                  <strong className="font-semibold">Demo event.</strong> Add your own times to see the results update. Nothing is saved; reload to start over.
                </span>
              </p>
              <LinkButton to="/new" size="sm" variant="primary">
                Create your own
              </LinkButton>
            </div>
          }
        />
      </ClientProvider>
    </AppShell>
  )
}
