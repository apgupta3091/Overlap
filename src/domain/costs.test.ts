import { describe, expect, it } from 'vitest'
import { compareToBudget, monthlyCost, moveInCash, netEffectiveRent } from './costs'

const base = {
  baseRentCents: 300000,
  parkingCents: null,
  petFeeCents: null,
  otherMonthlyFeesCents: null,
  utilitiesCents: null,
}

describe('monthlyCost', () => {
  it('labels totals with unknown fees as "Known monthly total"', () => {
    const c = monthlyCost({ ...base, parkingCents: 15000 })
    expect(c.totalCents).toBe(315000)
    expect(c.isComplete).toBe(false)
    expect(c.label).toBe('Known monthly total')
    expect(c.unknownLabels).toEqual(['Pet fee', 'Other monthly fees', 'Estimated utilities'])
  })

  it('distinguishes zero from unknown', () => {
    const allZero = monthlyCost({ ...base, parkingCents: 0, petFeeCents: 0, otherMonthlyFeesCents: 0, utilitiesCents: 0 })
    expect(allZero.isComplete).toBe(true)
    expect(allZero.label).toBe('Estimated monthly total')
    expect(allZero.totalCents).toBe(300000)

    const unknown = monthlyCost(base)
    expect(unknown.isComplete).toBe(false)
    expect(unknown.totalCents).toBe(300000)
  })

  it('sums every entered recurring cost in integer cents', () => {
    const c = monthlyCost({ baseRentCents: 245050, parkingCents: 17525, petFeeCents: 5000, otherMonthlyFeesCents: 1, utilitiesCents: 12000 })
    expect(c.totalCents).toBe(279576)
    expect(Number.isInteger(c.totalCents)).toBe(true)
  })
})

describe('netEffectiveRent', () => {
  it('applies base × (lease − free) ÷ lease', () => {
    expect(netEffectiveRent({ baseRentCents: 360000, leaseMonths: 12, freeMonths: 1 })).toBe(330000)
  })
  it('supports half-month concessions', () => {
    expect(netEffectiveRent({ baseRentCents: 360000, leaseMonths: 12, freeMonths: 1.5 })).toBe(315000)
  })
  it('rounds to the nearest cent', () => {
    // 100001 × 11 / 12 = 91667.58…
    expect(netEffectiveRent({ baseRentCents: 100001, leaseMonths: 12, freeMonths: 1 })).toBe(91668)
    // 250000 × 13 / 14 = 232142.857…
    expect(netEffectiveRent({ baseRentCents: 250000, leaseMonths: 14, freeMonths: 1 })).toBe(232143)
  })
  it('returns null without a concession or lease length', () => {
    expect(netEffectiveRent({ baseRentCents: 300000, leaseMonths: 12, freeMonths: 0 })).toBeNull()
    expect(netEffectiveRent({ baseRentCents: 300000, leaseMonths: 12, freeMonths: null })).toBeNull()
    expect(netEffectiveRent({ baseRentCents: 300000, leaseMonths: null, freeMonths: 1 })).toBeNull()
    expect(netEffectiveRent({ baseRentCents: 300000, leaseMonths: 1, freeMonths: 2 })).toBeNull()
  })
})

describe('moveInCash', () => {
  it('adds first month, deposit, and one-time fees', () => {
    expect(moveInCash({ baseRentCents: 300000, securityDepositCents: 300000, oneTimeFeesCents: 25000 })).toEqual({
      totalCents: 625000,
      isComplete: true,
      unknownLabels: [],
    })
  })
  it('flags missing deposit or fees as incomplete', () => {
    const m = moveInCash({ baseRentCents: 300000, securityDepositCents: null, oneTimeFeesCents: 0 })
    expect(m.isComplete).toBe(false)
    expect(m.totalCents).toBe(300000)
    expect(m.unknownLabels).toEqual(['Security deposit'])
  })
  it('treats zero fees as known', () => {
    expect(moveInCash({ baseRentCents: 100, securityDepositCents: 0, oneTimeFeesCents: 0 }).isComplete).toBe(true)
  })
})

describe('compareToBudget', () => {
  it('returns null with no budget', () => {
    expect(compareToBudget(null, monthlyCost(base))).toBeNull()
  })
  it('never claims affordability on partial data', () => {
    const r = compareToBudget(400000, monthlyCost(base))!
    expect(r.state).toBe('within_incomplete')
    expect(r.message).toBe('Known costs are within budget; additional costs may apply.')
  })
  it('reports within budget for complete estimates', () => {
    const r = compareToBudget(400000, monthlyCost({ ...base, parkingCents: 0, petFeeCents: 0, otherMonthlyFeesCents: 0, utilitiesCents: 10000 }))!
    expect(r.state).toBe('within')
    expect(r.message).toBe('Within budget by $900 (estimated)')
  })
  it('reports over budget even when incomplete, because known costs already exceed it', () => {
    const r = compareToBudget(250000, monthlyCost(base))!
    expect(r.state).toBe('over')
    expect(r.message).toBe('Known costs are over budget by $500')
  })
})
