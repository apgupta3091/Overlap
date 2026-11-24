import { useEffect, useMemo, useRef, type Dispatch, type PointerEvent, type SetStateAction } from 'react'
import { Check, Star } from 'lucide-react'
import type { Availability } from '../../domain/availability.ts'
import type { EventSlot, SlotState } from '../../domain/types'
import { formatLongDayOfInstant, formatTimeRange } from '../../lib/time/display'
import { buildSlotGrid } from '../../lib/time/grid'
import { SlotTable } from '../grid/SlotTable'

export type Brush = SlotState

/** Clicking a cell that already has the brush's state clears it; otherwise it takes the brush's state. */
export function toggledState(current: SlotState | undefined, brush: Brush): SlotState | null {
  return current === brush ? null : brush
}

function setSlot(prev: Availability, id: string, state: SlotState | null): Availability {
  if ((prev[id] ?? null) === state) return prev
  const next = { ...prev }
  if (state) next[id] = state
  else delete next[id]
  return next
}

const STATE_TEXT: Record<SlotState | 'none', string> = { none: 'not available', available: 'available', preferred: 'preferred' }

interface Props {
  slots: readonly EventSlot[]
  timeZone: string
  value: Availability
  onChange: Dispatch<SetStateAction<Availability>>
  brush: Brush
  disabled?: boolean
  describedBy?: string
  /** Called after a single-cell change (click, tap, keyboard), for screen-reader announcements. */
  onToggle?: (slot: EventSlot, state: SlotState | null) => void
}

/**
 * The availability painter. Mouse/pen: press and drag across cells to paint (the first cell decides
 * whether the drag adds or clears). Touch: tap cells (so the page still scrolls). Keyboard: arrows
 * move, Space/Enter toggles.
 */
export function AvailabilityGrid({ slots, timeZone, value, onChange, brush, disabled = false, describedBy, onToggle }: Props) {
  const layout = useMemo(() => buildSlotGrid(slots, timeZone), [slots, timeZone])
  const paint = useRef<{ target: SlotState | null; last: string | null } | null>(null)
  const suppressClick = useRef(false)
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  })

  useEffect(() => {
    function end() {
      if (!paint.current) return
      paint.current = null
      // The click that follows a mouse drag must not toggle again; clear the flag after it fires.
      setTimeout(() => {
        suppressClick.current = false
      }, 0)
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [])

  const cellFrom = (el: Element | null) => el?.closest<HTMLElement>('[data-slot-id]')?.dataset.slotId ?? null

  function onPointerDown(e: PointerEvent<HTMLTableElement>) {
    if (disabled || e.pointerType === 'touch' || e.button !== 0) return
    const id = cellFrom(e.target as Element)
    if (!id) return
    e.preventDefault() // no text selection while dragging
    ;(e.target as HTMLElement).closest<HTMLElement>('[data-slot-id]')?.focus()
    const target = toggledState(valueRef.current[id], brush)
    paint.current = { target, last: id }
    suppressClick.current = true
    onChange((prev) => setSlot(prev, id, target))
  }

  function onPointerMove(e: PointerEvent<HTMLTableElement>) {
    const p = paint.current
    if (!p) return
    const hit = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(e.clientX, e.clientY) : (e.target as Element)
    const id = cellFrom(hit)
    if (!id || id === p.last || !layout.positions.has(id)) return
    p.last = id
    onChange((prev) => setSlot(prev, id, p.target))
  }

  function onCellClick(slot: EventSlot) {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    const target = toggledState(valueRef.current[slot.id], brush)
    onChange((prev) => setSlot(prev, slot.id, target))
    onToggle?.(slot, target)
  }

  return (
    <SlotTable
      layout={layout}
      label="Your availability"
      aria-describedby={describedBy}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      className={disabled ? 'opacity-45' : ''}
      renderCell={(slot, props) => {
        const state = disabled ? undefined : value[slot.id]
        const label = `${formatLongDayOfInstant(slot.startAt, timeZone)}, ${formatTimeRange(slot.startAt, slot.endAt, timeZone)}: ${STATE_TEXT[state ?? 'none']}`
        return (
          <button
            {...props}
            type="button"
            disabled={disabled}
            aria-label={label}
            onClick={() => onCellClick(slot)}
            className={`flex h-7 w-full touch-manipulation items-center justify-center rounded-[5px] border transition-colors select-none sm:h-6 ${
              state === 'preferred'
                ? 'border-pref bg-pref text-pref-ink'
                : state === 'available'
                  ? 'border-avail-ink/25 bg-avail text-avail-ink'
                  : 'border-line-strong/70 bg-surface text-transparent hover:bg-sunken'
            } disabled:cursor-not-allowed`}
          >
            {state === 'preferred' ? <Star aria-hidden className="size-3.5 fill-current" /> : state === 'available' ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : null}
          </button>
        )
      }}
    />
  )
}
