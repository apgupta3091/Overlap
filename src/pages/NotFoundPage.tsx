import { SearchX } from 'lucide-react'
import { AppShell } from '../app/AppShell'
import { LinkButton } from '../components/ui/Button'
import { EmptyState } from '../components/ui/States'

export function NotFoundPage() {
  return (
    <AppShell>
      <EmptyState
        icon={<SearchX aria-hidden className="size-6" />}
        level={1}
        title="This page doesn’t exist"
        action={
          <>
            <LinkButton to="/new" variant="primary">Create an event</LinkButton>
            <LinkButton to="/demo">Try the demo</LinkButton>
          </>
        }
      >
        Check the link for typos. If someone shared an event with you, ask them to send the link again.
      </EmptyState>
    </AppShell>
  )
}
