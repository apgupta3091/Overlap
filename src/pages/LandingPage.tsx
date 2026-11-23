import { ArrowRight, Columns3, Link2, ThumbsUp, Wallet } from 'lucide-react'
import { AppShell } from '../app/AppShell'
import { LinkButton } from '../components/ui/Button'

const FEATURES = [
  { Icon: Link2, title: 'Save links from anywhere', body: 'Paste a listing link and the rent. Add photos, fees, and details whenever you have them.' },
  { Icon: Wallet, title: 'See what it really costs', body: 'Parking, pet fees, utilities, and concessions add up. Unknown costs are flagged, never assumed to be zero.' },
  { Icon: ThumbsUp, title: 'Vote together', body: 'Everyone marks Interested, Maybe, or Pass. Filter to the places you all agree on.' },
  { Icon: Columns3, title: 'Compare and decide', body: 'Put up to three apartments side by side, schedule tours, and keep notes from each visit.' },
]

export function LandingPage() {
  return (
    <AppShell
      nav={
        <nav aria-label="Account" className="flex items-center gap-1">
          <LinkButton to="/login" size="sm" variant="ghost">Sign in</LinkButton>
          <LinkButton to="/login?mode=signup" size="sm" variant="primary">Get started</LinkButton>
        </nav>
      }
    >
      <section className="mx-auto max-w-3xl py-10 text-center sm:py-16">
        <p className="text-sm font-semibold tracking-wide text-accent-strong uppercase">For roommates and couples</p>
        <h1 className="font-display mt-3 text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-6xl">
          One shared board for your apartment hunt.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-muted text-balance">
          Stop losing listings in the group chat. Save the places you find, compare real monthly costs, vote, and decide
          what to tour — together.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton to="/demo" variant="primary" icon={<ArrowRight aria-hidden className="size-4" />}>
            Try the demo — no account needed
          </LinkButton>
          <LinkButton to="/login?mode=signup">Create a free board</LinkButton>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="border-t border-line py-12">
        <h2 id="how-heading" className="sr-only">How Shortlist helps</h2>
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ Icon, title, body }) => (
            <li key={title}>
              <Icon aria-hidden className="size-6 text-accent" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1.5 text-[15px] text-ink-muted">{body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-12 text-center text-sm text-ink-faint">
          You find apartments on any site; Shortlist doesn’t import, scrape, or recommend listings.
        </p>
      </section>
    </AppShell>
  )
}
