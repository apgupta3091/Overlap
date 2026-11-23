// Minimal analytics adapter — disabled by default.
// Events carry only opaque ids and enums: never URLs, addresses, notes, emails, tokens, or images.
// Enable console logging in development with VITE_ANALYTICS=console. Wire a real sink in `send` if needed.

export type AnalyticsEvent =
  | { name: 'demo_opened' }
  | { name: 'board_created'; boardId: string }
  | { name: 'listing_added'; boardId: string }
  | { name: 'invite_created'; boardId: string }
  | { name: 'invite_accepted'; boardId: string }
  | { name: 'vote_submitted'; boardId: string }
  | { name: 'comparison_opened'; boardId: string; count: number }
  | { name: 'tour_scheduled'; boardId: string }

type Sink = (event: AnalyticsEvent & { at: string }) => void

const mode = import.meta.env.VITE_ANALYTICS as string | undefined

let sink: Sink | null = mode === 'console' ? (e) => console.info('[analytics]', e) : null

/** Replace the sink (used by tests or a future provider). Pass null to disable. */
export function setAnalyticsSink(next: Sink | null) {
  sink = next
}

export function track(event: AnalyticsEvent) {
  if (!sink) return
  try {
    sink({ ...event, at: new Date().toISOString() })
  } catch {
    // Analytics must never break the product.
  }
}
