import { useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { CalendarSearch, Clock, Globe2, User } from 'lucide-react'
import { Button, LinkButton } from '../../components/ui/Button'
import { SelectField } from '../../components/ui/Field'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { useClient } from '../../data/client'
import { getCredentials } from '../../data/credentials'
import { errorMessage, isServiceError } from '../../data/errors'
import { useEventSnapshot } from '../../data/hooks'
import { browserTimeZone } from '../../lib/time/display'
import { timeZoneOptions } from '../../lib/time/zones'
import { AvailabilityEditor } from '../availability/AvailabilityEditor'
import { ResultsPanel } from '../results/ResultsPanel'
import { CopyLinkButton, eventUrl, SharePanel } from './SharePanel'
import { Tabs } from './Tabs'

type TabKey = 'respond' | 'results'

function durationText(minutes: number): string {
  return minutes < 60 ? `${minutes} minutes` : minutes === 60 ? '1 hour' : `${minutes / 60} hours`
}

export function EventScreen({ publicId, banner }: { publicId: string; banner?: ReactNode }) {
  const client = useClient()
  const query = useEventSnapshot(publicId)
  const location = useLocation()
  const justCreated = (location.state as { justCreated?: boolean } | null)?.justCreated === true

  if (query.isPending) return <Spinner label="Loading event…" />
  if (query.isError) {
    if (isServiceError(query.error, 'not_found')) {
      return (
        <EmptyState
          level={1}
          icon={<CalendarSearch aria-hidden className="size-6" />}
          title="We couldn’t find this event"
          action={
            <>
              <LinkButton to="/new" variant="primary">
                Create an event
              </LinkButton>
              <LinkButton to="/demo">Try the demo</LinkButton>
            </>
          }
        >
          {client.localOnly
            ? 'In this preview build, events are saved only in the browser that created them. Check the link, or open it in that browser.'
            : 'Check the link for typos, or ask the organizer to send it again. Events are deleted 30 days after their last date.'}
        </EmptyState>
      )
    }
    return (
      <ErrorState
        level={1}
        title="Couldn’t load this event"
        message={errorMessage(query.error)}
        action={<Button onClick={() => void query.refetch()}>Try again</Button>}
      />
    )
  }

  return <LoadedEvent key={publicId} publicId={publicId} snapshot={query.data} justCreated={justCreated} banner={banner} />
}

function LoadedEvent({
  publicId,
  snapshot,
  justCreated,
  banner,
}: {
  publicId: string
  snapshot: NonNullable<ReturnType<typeof useEventSnapshot>['data']>
  justCreated: boolean
  banner?: ReactNode
}) {
  const client = useClient()
  const { event, responses } = snapshot
  const cred = getCredentials(client.store, publicId)
  const isOrganizer = Boolean(cred.adminToken)
  const hasResponded = responses.some((r) => r.id === cred.responseId)

  const [tab, setTab] = useState<TabKey>(hasResponded ? 'results' : 'respond')
  const browserTz = useMemo(() => browserTimeZone(), [])
  const [timeZone, setTimeZone] = useState(browserTz)
  const zoneOptions = useMemo(() => timeZoneOptions([browserTz, event.timezone]), [browserTz, event.timezone])

  return (
    <div className="space-y-6">
      {banner}
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-balance break-words sm:text-3xl">{event.title}</h1>
          {!isOrganizer && !client.demo && <CopyLinkButton url={eventUrl(publicId)} size="sm" />}
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
          <li className="inline-flex items-center gap-1.5">
            <User aria-hidden className="size-4" />
            Organized by {event.organizerName}
            {isOrganizer && ' (you)'}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Clock aria-hidden className="size-4" />
            {durationText(event.durationMinutes)}
          </li>
        </ul>
        {event.description && <p className="max-w-2xl text-[15px] whitespace-pre-line break-words">{event.description}</p>}
      </header>

      {isOrganizer && <SharePanel publicId={publicId} justCreated={justCreated} localOnly={client.localOnly} />}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-3">
        <Globe2 aria-hidden className="mb-3 size-5 shrink-0 text-ink-muted" />
        <SelectField
          label="Show times in"
          options={zoneOptions}
          value={timeZone}
          onChange={(e) => setTimeZone(e.target.value)}
          wrapperClassName="min-w-0 flex-1 sm:max-w-sm"
          hint={
            timeZone === event.timezone
              ? 'This is the timezone the organizer used.'
              : `The organizer planned this in ${event.timezone.replace(/_/g, ' ')}.`
          }
        />
      </div>

      <Tabs<TabKey>
        label="Event sections"
        active={tab}
        onChange={setTab}
        tabs={[
          {
            key: 'respond',
            label: hasResponded ? 'Your availability' : 'Add your availability',
            panel: <AvailabilityEditor event={event} responses={responses} timeZone={timeZone} onSaved={() => setTab('results')} />,
          },
          {
            key: 'results',
            label: `Group results (${responses.length})`,
            panel: (
              <ResultsPanel
                event={event}
                responses={responses}
                timeZone={timeZone}
                myResponseId={cred.responseId}
                emptyAction={
                  hasResponded ? undefined : (
                    <Button variant="primary" onClick={() => setTab('respond')}>
                      Add your availability
                    </Button>
                  )
                }
              />
            ),
          },
        ]}
      />
    </div>
  )
}
