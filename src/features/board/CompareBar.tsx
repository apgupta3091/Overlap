import { Columns3, X } from 'lucide-react'
import { MAX_COMPARE, MIN_COMPARE } from '../../domain/compare'
import { Button, LinkButton } from '../../components/ui/Button'
import { comparePath } from './BoardScope'

export function CompareBar({ basePath, selected, onClear }: { basePath: string; selected: string[]; onClear: () => void }) {
  if (selected.length === 0) return null
  const canCompare = selected.length >= MIN_COMPARE
  const full = selected.length >= MAX_COMPARE
  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:mx-0 sm:mb-4 sm:rounded-2xl sm:border sm:shadow-raised">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div aria-live="polite">
          <p className="text-sm font-semibold">{selected.length} of {MAX_COMPARE} selected to compare</p>
          <p id="compare-limit-help" className="text-xs text-ink-muted">
            {full ? 'That’s the maximum — deselect one to swap in another.' : canCompare ? 'Ready to compare.' : 'Select at least one more apartment.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onClear} icon={<X aria-hidden className="size-4" />}>Clear</Button>
          {canCompare ? (
            <LinkButton size="sm" variant="primary" to={comparePath(basePath, selected)} icon={<Columns3 aria-hidden className="size-4" />}>
              Compare {selected.length}
            </LinkButton>
          ) : (
            <Button size="sm" variant="primary" disabled icon={<Columns3 aria-hidden className="size-4" />}>Compare</Button>
          )}
        </div>
      </div>
    </div>
  )
}
