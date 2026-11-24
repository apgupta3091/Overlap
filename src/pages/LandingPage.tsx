import { ArrowRight, CalendarCheck, Link2, MousePointerClick } from 'lucide-react'
import { AppShell } from '../app/AppShell'
import { LinkButton } from '../components/ui/Button'

const STEPS = [
  { Icon: Link2, title: 'Create and share a link', body: 'Pick a few dates and a time range. Send the link to your group however you already talk.' },
  { Icon: MousePointerClick, title: 'Everyone marks their times', body: 'No account, no app. Tap the times that work, and mark the ones you’d prefer.' },
  { Icon: CalendarCheck, title: 'Pick the overlap', body: 'See when the most people are free, choose a time, and download a calendar event.' },
]

export function LandingPage() {
  return (
    <AppShell
      nav={
        <nav aria-label="Main" className="flex items-center gap-1">
          <LinkButton to="/demo" size="sm" variant="ghost">Demo</LinkButton>
          <LinkButton to="/new" size="sm" variant="primary">Create event</LinkButton>
        </nav>
      }
    >
      <section className="mx-auto max-w-2xl py-10 text-center sm:py-16">
        <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
          Find a time together, without the group-chat back-and-forth.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-balance text-ink-muted">
          For study sessions, interview practice, clubs, games, and plans with friends.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton to="/new" variant="primary" icon={<ArrowRight aria-hidden className="size-4" />}>
            Create an event
          </LinkButton>
          <LinkButton to="/demo">Try the demo</LinkButton>
        </div>
        <p className="mt-4 text-sm text-ink-faint">Free. No sign-up for you or your group.</p>
      </section>

      <section aria-labelledby="how-heading" className="border-t border-line py-12">
        <h2 id="how-heading" className="sr-only">How it works</h2>
        <ol className="grid gap-8 sm:grid-cols-3">
          {STEPS.map(({ Icon, title, body }, i) => (
            <li key={title}>
              <Icon aria-hidden className="size-6 text-accent" />
              <h3 className="mt-3 font-semibold">
                <span className="sr-only">Step {i + 1}: </span>
                {title}
              </h3>
              <p className="mt-1.5 text-[15px] text-ink-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  )
}
