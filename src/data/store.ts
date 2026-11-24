// Minimal key-value storage. localStorage in the app; an in-memory map for the demo and tests.

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

/** localStorage that never throws (private browsing, quota, disabled storage). Falls back to memory. */
export function safeLocalStorage(): KeyValueStore {
  const fallback = memoryStore()
  const ls = (): Storage | null => {
    try {
      return typeof window !== 'undefined' ? window.localStorage : null
    } catch {
      return null
    }
  }
  return {
    getItem(k) {
      try {
        return ls()?.getItem(k) ?? fallback.getItem(k)
      } catch {
        return fallback.getItem(k)
      }
    },
    setItem(k, v) {
      try {
        const s = ls()
        if (s) s.setItem(k, v)
        else fallback.setItem(k, v)
      } catch {
        fallback.setItem(k, v)
      }
    },
    removeItem(k) {
      try {
        ls()?.removeItem(k)
      } catch {
        // ignore
      }
      fallback.removeItem(k)
    },
  }
}

export function readJson<T>(store: KeyValueStore, key: string): T | null {
  const raw = store.getItem(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeJson(store: KeyValueStore, key: string, value: unknown): void {
  store.setItem(key, JSON.stringify(value))
}
