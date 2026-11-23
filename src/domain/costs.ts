// Pure cost calculations. Inputs are integer cents; `null` means unknown.
import { formatCents } from './money'

type CostInput = {
  baseRentCents: number
  parkingCents: number | null
  petFeeCents: number | null
  otherMonthlyFeesCents: number | null
  utilitiesCents: number | null
}

export const RECURRING_COST_FIELDS = [
  { key: 'parkingCents', label: 'Parking' },
  { key: 'petFeeCents', label: 'Pet fee' },
  { key: 'otherMonthlyFeesCents', label: 'Other monthly fees' },
  { key: 'utilitiesCents', label: 'Estimated utilities' },
] as const satisfies readonly { key: keyof CostInput; label: string }[]

export interface MonthlyCost {
  baseRentCents: number
  /** base rent + every recurring cost that is known */
  totalCents: number
  /** true only when every recurring cost was explicitly entered (0 counts as entered) */
  isComplete: boolean
  unknownLabels: string[]
  /** "Estimated monthly total" when complete (utilities are estimates), otherwise "Known monthly total" */
  label: 'Estimated monthly total' | 'Known monthly total'
}

export function monthlyCost(listing: CostInput): MonthlyCost {
  let total = listing.baseRentCents
  const unknownLabels: string[] = []
  for (const field of RECURRING_COST_FIELDS) {
    const value = listing[field.key]
    if (value === null) unknownLabels.push(field.label)
    else total += value
  }
  const isComplete = unknownLabels.length === 0
  return {
    baseRentCents: listing.baseRentCents,
    totalCents: total,
    isComplete,
    unknownLabels,
    label: isComplete ? 'Estimated monthly total' : 'Known monthly total',
  }
}

/**
 * Net effective base rent: base × (lease − free) ÷ lease, rounded to the nearest cent.
 * Returns null when there is no concession or the lease length is unknown.
 */
export function netEffectiveRent(listing: {
  baseRentCents: number
  leaseMonths: number | null
  freeMonths: number | null
}): number | null {
  const { baseRentCents, leaseMonths, freeMonths } = listing
  if (leaseMonths === null || leaseMonths <= 0) return null
  if (freeMonths === null || freeMonths <= 0) return null
  if (freeMonths > leaseMonths) return null
  // Free months may be fractional (e.g. 1.5); scale to keep integer math exact.
  return Math.round((baseRentCents * (leaseMonths * 2 - freeMonths * 2)) / (leaseMonths * 2))
}

export interface MoveInCash {
  totalCents: number
  isComplete: boolean
  unknownLabels: string[]
}

/** First month's base rent + security deposit + one-time fees (only those entered). */
export function moveInCash(listing: {
  baseRentCents: number
  securityDepositCents: number | null
  oneTimeFeesCents: number | null
}): MoveInCash {
  const unknownLabels: string[] = []
  let total = listing.baseRentCents
  if (listing.securityDepositCents === null) unknownLabels.push('Security deposit')
  else total += listing.securityDepositCents
  if (listing.oneTimeFeesCents === null) unknownLabels.push('One-time fees')
  else total += listing.oneTimeFeesCents
  return { totalCents: total, isComplete: unknownLabels.length === 0, unknownLabels }
}

export const MOVE_IN_LABEL = 'Estimated move-in cash — assumes one full month’s rent upfront.'

export type BudgetState = 'within' | 'within_incomplete' | 'over'

export interface BudgetComparison {
  state: BudgetState
  message: string
  /** positive = under budget, negative = over budget */
  differenceCents: number
}

/** Compare the board's total budget with the listing's known/estimated monthly total. */
export function compareToBudget(budgetCents: number | null, cost: MonthlyCost): BudgetComparison | null {
  if (budgetCents === null) return null
  const difference = budgetCents - cost.totalCents
  if (difference < 0) {
    const prefix = cost.isComplete ? 'Over budget' : 'Known costs are over budget'
    return { state: 'over', differenceCents: difference, message: `${prefix} by ${formatCents(-difference)}` }
  }
  if (!cost.isComplete) {
    return {
      state: 'within_incomplete',
      differenceCents: difference,
      message: 'Known costs are within budget; additional costs may apply.',
    }
  }
  return {
    state: 'within',
    differenceCents: difference,
    message:
      difference === 0 ? 'Estimated total matches budget' : `Within budget by ${formatCents(difference)} (estimated)`,
  }
}
