import { MapPinOff } from 'lucide-react'
import { AppShell } from '../app/AppShell'
import { LinkButton } from '../components/ui/Button'
import { EmptyState } from '../components/ui/States'

export function NotFoundPage() {
  return (
    <AppShell>
      <EmptyState
        icon={<MapPinOff aria-hidden className="size-6" />}
        title="This page doesn’t exist"
        action={
          <>
            <LinkButton to="/" variant="primary">Go home</LinkButton>
            <LinkButton to="/demo">Try the demo</LinkButton>
          </>
        }
      >
        The link may be mistyped, or the board or apartment may have been deleted.
      </EmptyState>
    </AppShell>
  )
}
