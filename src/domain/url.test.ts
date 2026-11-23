import { describe, expect, it } from 'vitest'
import { isSafeHttpUrl, normalizeListingUrl, validateListingUrl } from './url'

describe('validateListingUrl', () => {
  it.each(['https://streeteasy.com/rental/123', 'http://example.com/a?b=c', 'HTTPS://Example.com'])('accepts %s', (u) => {
    expect(validateListingUrl(u).ok).toBe(true)
  })
  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://example.com/x',
    'vbscript:msgbox',
    'example.com/listing',
    '',
    'https://localhost',
    'https://user:pass@example.com/',
  ])('rejects %s', (u) => {
    expect(validateListingUrl(u).ok).toBe(false)
    expect(isSafeHttpUrl(u)).toBe(false)
  })
  it('rejects overly long URLs', () => {
    expect(validateListingUrl(`https://example.com/${'a'.repeat(2100)}`).ok).toBe(false)
  })
})

describe('normalizeListingUrl', () => {
  it('treats scheme, www, case of host, fragment, and trailing slash as equivalent', () => {
    const a = normalizeListingUrl('https://www.StreetEasy.com/building/foo/4b/#photos')
    const b = normalizeListingUrl('http://streeteasy.com/building/foo/4b')
    expect(a).toBe(b)
  })
  it('keeps query parameters, which may identify the listing', () => {
    expect(normalizeListingUrl('https://example.com/rent?id=1')).not.toBe(normalizeListingUrl('https://example.com/rent?id=2'))
    expect(normalizeListingUrl('https://example.com/rent?id=1')).toBe('example.com/rent?id=1')
  })
  it('keeps path case (paths can be case-sensitive)', () => {
    expect(normalizeListingUrl('https://example.com/A')).not.toBe(normalizeListingUrl('https://example.com/a'))
  })
})
