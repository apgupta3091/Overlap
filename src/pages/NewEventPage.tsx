import { AppShell } from '../app/AppShell'
import { CreateEventForm } from '../features/create/CreateEventForm'

export function NewEventPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create an event</h1>
        <p className="mt-2 text-ink-muted">No account needed. You’ll get a link to share with your group.</p>
        <div className="mt-8">
          <CreateEventForm />
        </div>
      </div>
    </AppShell>
  )
}
