import { useParams } from 'react-router'
import { AppShell } from '../app/AppShell'

/** Stub — participation & results implemented in Chunks 5–6, live data in Chunk 9. */
export function EventPage() {
  const { publicId } = useParams()
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Event</h1>
      <p className="mt-2 text-ink-muted">Event pages are coming soon.</p>
      <p className="sr-only">Event id {publicId}</p>
    </AppShell>
  )
}
