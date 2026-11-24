// Bearer secrets for organizers (admin) and participants (edit). 256 bits from the CSPRNG,
// base64url-encoded (43 chars). The database only ever sees SHA-256 hashes.

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Lowercase hex SHA-256 of the token's UTF-8 bytes. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Extract a well-formed token from `Authorization: Bearer <token>`; null otherwise. */
export function bearerToken(header: string | null): string | null {
  const m = /^Bearer ([A-Za-z0-9_-]+)$/.exec(header ?? '')
  return m && TOKEN_PATTERN.test(m[1]!) ? m[1]! : null
}
