import { useCallback, useState, type KeyboardEvent, type ReactNode, type TableHTMLAttributes } from 'react'
import type { EventSlot } from '../../domain/types'
import { moveInGrid, type GridDirection, type SlotGridLayout } from '../../lib/time/grid'

export interface CellProps {
  tabIndex: number
  onFocus: () => void
  'data-slot-id': string
}

interface SlotTableProps extends Omit<TableHTMLAttributes<HTMLTableElement>, 'children'> {
  layout: SlotGridLayout
  /** Accessible name for the table. */
  label: string
  renderCell: (slot: EventSlot, props: CellProps) => ReactNode
  /** Extra classes for each <td> holding a slot. */
  cellClassName?: string
}

const KEYS: Record<string, GridDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Home: 'rowStart',
  End: 'rowEnd',
}

/**
 * Day × time table of slots. One tab stop for the whole table (roving tabindex); arrow keys move
 * between slots, Home/End go to the row's ends, Ctrl+Home/End to the first/last slot.
 */
export function SlotTable({ layout, label, renderCell, cellClassName = '', className = '', onKeyDown, ...rest }: SlotTableProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const firstId = layout.cells.flat().find((c) => c !== null)?.id ?? null
  const currentId = activeId !== null && layout.positions.has(activeId) ? activeId : firstId

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTableElement>) => {
      onKeyDown?.(e)
      if (e.defaultPrevented) return
      let dir = KEYS[e.key]
      if (!dir) return
      if ((e.ctrlKey || e.metaKey) && dir === 'rowStart') dir = 'first'
      if ((e.ctrlKey || e.metaKey) && dir === 'rowEnd') dir = 'last'
      const id = (e.target as HTMLElement).closest<HTMLElement>('[data-slot-id]')?.dataset.slotId
      const from = id ? layout.positions.get(id) : undefined
      if (!from) return
      e.preventDefault()
      const [r, c] = moveInGrid(layout, from, dir)
      const next = layout.cells[r]?.[c]
      if (next) {
        setActiveId(next.id)
        const table = e.currentTarget
        const el = [...table.querySelectorAll<HTMLElement>('[data-slot-id]')].find((x) => x.dataset.slotId === next.id)
        el?.focus()
      }
    },
    [layout, onKeyDown],
  )

  const cols = layout.columns.length
  return (
    <div className="overflow-x-auto">
      <table
        aria-label={label}
        className={`w-full table-fixed border-separate border-spacing-x-1 border-spacing-y-0.5 ${className}`}
        style={{ maxWidth: `${5 + cols * 8}rem`, minWidth: `${4 + cols * 2.6}rem` }}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        <colgroup>
          <col className="w-16 sm:w-20" />
          {layout.columns.map((c) => (
            <col key={c.date} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <td />
            {layout.columns.map((c) => (
              <th key={c.date} scope="col" abbr={c.label} className="pb-2 text-center align-bottom font-normal">
                <span className="block text-xs text-ink-muted">{c.weekday}</span>
                <span className="block text-sm font-semibold text-ink">{c.monthDay}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {layout.rows.map((gridRow, r) => (
            <tr key={gridRow.key}>
              <th
                scope="row"
                className={`sticky left-0 z-10 bg-canvas pr-1 text-right align-top text-[11px] leading-none font-normal whitespace-nowrap text-ink-muted tabular-nums sm:text-xs ${gridRow.gapBefore ? 'pt-3' : ''}`}
              >
                <span className="relative -top-1">{gridRow.label}</span>
              </th>
              {layout.cells[r]!.map((slot, c) => (
                <td key={layout.columns[c]!.date} className={`p-0 ${gridRow.gapBefore ? 'pt-3' : ''} ${slot ? cellClassName : ''}`}>
                  {slot
                    ? renderCell(slot, {
                        tabIndex: slot.id === currentId ? 0 : -1,
                        onFocus: () => setActiveId(slot.id),
                        'data-slot-id': slot.id,
                      })
                    : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
