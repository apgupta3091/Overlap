import { describe, expect, it } from 'vitest'
import { EMPTY_LISTING_FORM, listingFormSchema } from './listingSchema'

const parse = (over: Partial<typeof EMPTY_LISTING_FORM>) =>
  listingFormSchema.safeParse({ ...EMPTY_LISTING_FORM, listingUrl: 'https://example.com/1', baseRent: '2400', ...over })

const firstError = (r: ReturnType<typeof parse>, path: string) =>
  r.success ? undefined : r.error.issues.find((i) => i.path.join('.') === path)?.message

describe('listingFormSchema', () => {
  it('accepts only URL and rent', () => {
    const r = parse({})
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.baseRent).toBe(240000)
      expect(r.data.parking).toBeNull()
      expect(r.data.bedrooms).toBeNull()
    }
  })
  it('keeps 0 distinct from blank', () => {
    const r = parse({ parking: '0', bedrooms: '0' })
    expect(r.success && r.data.parking).toBe(0)
    expect(r.success && r.data.bedrooms).toBe(0)
  })
  it('rejects unsafe URL schemes', () => {
    expect(firstError(parse({ listingUrl: 'javascript:alert(1)' }), 'listingUrl')).toMatch(/http/)
  })
  it('requires positive rent', () => {
    expect(firstError(parse({ baseRent: '' }), 'baseRent')).toBe('Enter the monthly rent.')
    expect(firstError(parse({ baseRent: '0' }), 'baseRent')).toBe('Rent must be more than $0.')
  })
  it('rejects negative fees', () => {
    expect(firstError(parse({ parking: '-10' }), 'parking')).toBeDefined()
  })
  it('validates bedrooms and half-step bathrooms', () => {
    expect(firstError(parse({ bedrooms: '1.5' }), 'bedrooms')).toMatch(/whole number/)
    expect(parse({ bathrooms: '1.5' }).success).toBe(true)
    expect(firstError(parse({ bathrooms: '1.25' }), 'bathrooms')).toMatch(/0.5/)
  })
  it('requires a lease length for a concession, and free months ≤ lease', () => {
    expect(firstError(parse({ freeMonths: '1' }), 'leaseMonths')).toMatch(/lease length/)
    expect(firstError(parse({ freeMonths: '13', leaseMonths: '12' }), 'freeMonths')).toMatch(/exceed/)
    expect(firstError(parse({ leaseMonths: '0' }), 'leaseMonths')).toMatch(/greater than 0/)
  })
  it('limits text length', () => {
    expect(firstError(parse({ title: 'x'.repeat(121) }), 'title')).toMatch(/120/)
  })
})
