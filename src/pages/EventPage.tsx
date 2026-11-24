import { useParams } from 'react-router'
import { AppShell } from '../app/AppShell'
import { EventScreen } from '../features/event/EventScreen'

export function EventPage() {
  const { publicId = '' } = useParams()
  return (
    <AppShell>
      <EventScreen publicId={publicId} />
    </AppShell>
  )
}
