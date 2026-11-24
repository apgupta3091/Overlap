// Lays out slots as a day × time-of-day matrix in the *display* timezone.
// Columns are local dates; rows are local start times. Cells with no slot are empty, so ranges with
// different hours (or split by a timezone shift) still line up by clock time.
import { Temporal } from 'temporal-polyfill'
import type { EventSlot } from '../../domain/types'
import { formatPlainDate } from './display'

export interface GridColumn {
  date: string
  weekday: string
  monthDay: string
  label: string
}

export interface GridRow {
  key: string
  /** "9:00 AM"; repeated wall-clock times on a fall-back day get an offset suffix. */
  label: string
  /** True when this row doesn't directly follow the previous one (a gap in the candidate times). */
  gapBefore: boolean
}

export interface SlotGridLayout {
  columns: GridColumn[]
  rows: GridRow[]
  /** cells[row][col] */
  cells: (EventSlot | null)[][]
  /** slotId → [row, col] */
  positions: Map<string, [number, number]>
}

const timeLabel = (t: Temporal.PlainTime) => t.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })

export function buildSlotGrid(slots: readonly EventSlot[], tz: string): SlotGridLayout {
  const sorted = [...slots].sort((a, b) => Temporal.Instant.compare(a.startAt, b.startAt))
  const dates = new Set<string>()
  const rowMeta = new Map<string, { minutes: number; label: string; repeat: number }>()
  const placed: { slot: EventSlot; date: string; rowKey: string }[] = []
  const taken = new Set<string>()

  for (const slot of sorted) {
    const z = Temporal.Instant.from(slot.startAt).toZonedDateTimeISO(tz)
    const date = z.toPlainDate().toString()
    const time = z.toPlainTime()
    const base = time.toString({ smallestUnit: 'minute' })
    // A repeated wall-clock time (DST fall-back in the display zone) gets its own row.
    let repeat = 0
    while (taken.has(`${date}|${base}#${repeat}`)) repeat++
    const rowKey = `${base}#${repeat}`
    taken.add(`${date}|${rowKey}`)
    dates.add(date)
    if (!rowMeta.has(rowKey)) {
      rowMeta.set(rowKey, {
        minutes: time.hour * 60 + time.minute,
        label: repeat === 0 ? timeLabel(time) : `${timeLabel(time)} (${z.offset})`,
        repeat,
      })
    }
    placed.push({ slot, date, rowKey })
  }

  const columns: GridColumn[] = [...dates].sort().map((date) => {
    const d = Temporal.PlainDate.from(date)
    return {
      date,
      weekday: d.toLocaleString('en-US', { weekday: 'short' }),
      monthDay: d.toLocaleString('en-US', { month: 'short', day: 'numeric' }),
      label: formatPlainDate(date, 'long'),
    }
  })
  const rowKeys = [...rowMeta.keys()].sort((a, b) => {
    const ma = rowMeta.get(a)!
    const mb = rowMeta.get(b)!
    return ma.minutes - mb.minutes || ma.repeat - mb.repeat
  })
  const rows: GridRow[] = rowKeys.map((k, i) => {
    const m = rowMeta.get(k)!
    const prev = i > 0 ? rowMeta.get(rowKeys[i - 1]!)! : null
    return { key: k, label: m.label, gapBefore: prev !== null && m.minutes - prev.minutes > 30 }
  })

  const colIndex = new Map(columns.map((c, i) => [c.date, i]))
  const rowIndex = new Map(rowKeys.map((k, i) => [k, i]))
  const cells: (EventSlot | null)[][] = rows.map(() => columns.map(() => null))
  const positions = new Map<string, [number, number]>()
  for (const { slot, date, rowKey } of placed) {
    const r = rowIndex.get(rowKey)!
    const c = colIndex.get(date)!
    cells[r]![c] = slot
    positions.set(slot.id, [r, c])
  }
  return { columns, rows, cells, positions }
}

export type GridDirection = 'up' | 'down' | 'left' | 'right' | 'rowStart' | 'rowEnd' | 'first' | 'last'

/** Next non-empty cell from `from` in a direction (skipping empty cells); stays put at the edge. */
export function moveInGrid(layout: SlotGridLayout, from: [number, number], dir: GridDirection): [number, number] {
  const { cells } = layout
  const rows = cells.length
  const cols = cells[0]?.length ?? 0
  const has = (r: number, c: number) => cells[r]?.[c] != null
  const [r0, c0] = from
  const scan = (dr: number, dc: number): [number, number] => {
    let r = r0 + dr
    let c = c0 + dc
    while (r >= 0 && r < rows && c >= 0 && c < cols) {
      if (has(r, c)) return [r, c]
      r += dr
      c += dc
    }
    return from
  }
  switch (dir) {
    case 'up':
      return scan(-1, 0)
    case 'down':
      return scan(1, 0)
    case 'left':
      return scan(0, -1)
    case 'right':
      return scan(0, 1)
    case 'rowStart':
      for (let c = 0; c < cols; c++) if (has(r0, c)) return [r0, c]
      return from
    case 'rowEnd':
      for (let c = cols - 1; c >= 0; c--) if (has(r0, c)) return [r0, c]
      return from
    case 'first':
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (has(r, c)) return [r, c]
      return from
    case 'last':
      for (let r = rows - 1; r >= 0; r--) for (let c = cols - 1; c >= 0; c--) if (has(r, c)) return [r, c]
      return from
  }
}
