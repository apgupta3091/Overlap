import { AlertCircle, CheckCircle2, CircleAlert } from 'lucide-react'
import { compareToBudget, monthlyCost, netEffectiveRent } from '../../domain/costs'
import { formatCents } from '../../domain/money'
import type { Listing } from '../../domain/types'

export function IncompleteCostsTag({ labels }: { labels: string[] }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-warn" title={`Unknown: ${labels.join(', ')}`}>
      <AlertCircle aria-hidden className="size-3.5" />
      Some costs unknown
    </span>
  )
}

export function BudgetIndicator({ budgetCents, listing }: { budgetCents: number | null; listing: Listing }) {
  const result = compareToBudget(budgetCents, monthlyCost(listing))
  if (!result) return null
  const Icon = result.state === 'over' ? CircleAlert : CheckCircle2
  const color = result.state === 'over' ? 'text-bad' : result.state === 'within' ? 'text-good' : 'text-ink-muted'
  return (
    <p className={`flex items-start gap-1.5 text-xs ${color}`}>
      <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{result.message}</span>
    </p>
  )
}

/** Card-sized cost block: monthly total first, base rent alongside, completeness flagged. */
export function CardCost({ listing }: { listing: Listing }) {
  const cost = monthlyCost(listing)
  const net = netEffectiveRent(listing)
  const hasExtras = cost.totalCents !== cost.baseRentCents
  return (
    <div className="flex flex-col gap-0.5">
      <p className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold tracking-tight">{formatCents(cost.totalCents)}</span>
        <span className="text-sm text-ink-muted">/mo</span>
      </p>
      <p className="text-xs text-ink-muted">
        {cost.label}
        {hasExtras && <> · {formatCents(cost.baseRentCents)} base rent</>}
        {!hasExtras && !cost.isComplete && <> · base rent only</>}
      </p>
      {net !== null && <p className="text-xs text-ink-muted">Net effective base rent {formatCents(net)}</p>}
      {!cost.isComplete && <IncompleteCostsTag labels={cost.unknownLabels} />}
    </div>
  )
}
