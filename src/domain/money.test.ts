import { describe, expect, it } from 'vitest'
import { centsToInput, formatCents, formatMaybeCents, parseDollarsToCents } from './money'

describe('parseDollarsToCents', () => {
  it.each([
    ['2450', 245000],
    ['2,450', 245000],
    ['$2,450.5', 245050],
    ['0.1', 10],
    ['0.07', 7],
    ['0', 0],
    [' 1200.99 ', 120099],
  ])('parses %s', (input, expected) => {
    expect(parseDollarsToCents(input)).toBe(expected)
  })

  it('treats blank as unknown (null), never zero', () => {
    expect(parseDollarsToCents('')).toBeNull()
    expect(parseDollarsToCents('   ')).toBeNull()
  })

  it.each(['abc', '1.234', '-5', '1,23', '12e3', '$'])('rejects %s', (input) => {
    expect(parseDollarsToCents(input)).toBeNaN()
  })

  it('avoids floating-point error (0.29 is 29 cents)', () => {
    expect(parseDollarsToCents('0.29')).toBe(29)
    expect(parseDollarsToCents('1.15')).toBe(115)
  })
})

describe('formatting', () => {
  it('omits cents for whole dollars', () => {
    expect(formatCents(245000)).toBe('$2,450')
    expect(formatCents(245050)).toBe('$2,450.50')
  })
  it('shows Unknown for null', () => {
    expect(formatMaybeCents(null)).toBe('Unknown')
    expect(formatMaybeCents(0)).toBe('$0')
  })
  it('round-trips to input strings', () => {
    expect(centsToInput(245005)).toBe('2450.05')
    expect(centsToInput(0)).toBe('0')
    expect(centsToInput(null)).toBe('')
  })
})
