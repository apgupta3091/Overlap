export const MAX_COMPARE = 3
export const MIN_COMPARE = 2

export type ToggleResult = { selected: string[]; limitReached: boolean }

/** Toggle a listing in the comparison selection, refusing a fourth item. */
export function toggleCompareSelection(selected: readonly string[], id: string): ToggleResult {
  if (selected.includes(id)) return { selected: selected.filter((s) => s !== id), limitReached: false }
  if (selected.length >= MAX_COMPARE) return { selected: [...selected], limitReached: true }
  return { selected: [...selected, id], limitReached: false }
}

const UUIDISH = /^[A-Za-z0-9_-]{1,64}$/

/** Parse `?ids=a,b,c` defensively: dedupe, drop malformed values, cap at the limit. */
export function parseCompareIds(raw: string | null): string[] {
  if (!raw) return []
  const ids: string[] = []
  for (const part of raw.split(',')) {
    const id = part.trim()
    if (UUIDISH.test(id) && !ids.includes(id)) ids.push(id)
    if (ids.length === MAX_COMPARE) break
  }
  return ids
}
