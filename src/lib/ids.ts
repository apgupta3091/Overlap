const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** Unbiased random base62 id from the platform CSPRNG. */
export function randomId(length = 12): string {
  let out = ''
  const buf = new Uint8Array(length * 2)
  while (out.length < length) {
    crypto.getRandomValues(buf)
    for (const b of buf) {
      if (b < 248 && out.length < length) out += ALPHABET[b % 62]
    }
  }
  return out
}
