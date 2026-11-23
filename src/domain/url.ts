// Listing URL validation and conservative normalization (used only for duplicate warnings).

export const MAX_URL_LENGTH = 2048

export type UrlValidation = { ok: true; url: URL } | { ok: false; reason: string }

export function validateListingUrl(input: string): UrlValidation {
  const trimmed = input.trim()
  if (trimmed === '') return { ok: false, reason: 'Paste the link to the listing.' }
  if (trimmed.length > MAX_URL_LENGTH) return { ok: false, reason: 'That link is too long.' }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'Enter a full link starting with https:// or http://' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'Only http:// and https:// links are allowed.' }
  }
  if (!url.hostname || !url.hostname.includes('.')) {
    return { ok: false, reason: 'Enter a full link, like https://example.com/apartment/123' }
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'Links containing usernames or passwords are not allowed.' }
  }
  return { ok: true, url }
}

/** True only for well-formed http(s) URLs. Use before rendering any stored URL as a link. */
export function isSafeHttpUrl(input: string): boolean {
  return validateListingUrl(input).ok
}

/**
 * Normalize for duplicate detection only. Conservative:
 * - ignores scheme (http vs https) and a leading "www."
 * - lowercases the host, drops the fragment and a trailing slash on the path
 * - keeps the query string untouched because it can identify the listing
 */
export function normalizeListingUrl(input: string): string {
  const result = validateListingUrl(input)
  if (!result.ok) return input.trim()
  const { url } = result
  const host = url.host.toLowerCase().replace(/^www\./, '')
  let path = url.pathname
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  if (path === '/') path = ''
  return `${host}${path}${url.search}`
}

/** Short display version of a listing URL, e.g. "streeteasy.com". */
export function displayHost(input: string): string {
  const result = validateListingUrl(input)
  return result.ok ? result.url.hostname.replace(/^www\./, '') : 'link'
}
