import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface TabDef<K extends string> {
  key: K
  label: ReactNode
  panel: ReactNode
}

/** Accessible tabs (automatic activation). Panels stay mounted so unsaved edits survive switching. */
export function Tabs<K extends string>({ tabs, active, onChange, label }: { tabs: TabDef<K>[]; active: K; onChange: (k: K) => void; label: string }) {
  const base = useId()
  const refs = useRef(new Map<K, HTMLButtonElement>())
  function onKeyDown(e: KeyboardEvent) {
    const i = tabs.findIndex((t) => t.key === active)
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next < 0) return
    e.preventDefault()
    const k = tabs[next]!.key
    onChange(k)
    refs.current.get(k)?.focus()
  }
  return (
    <div>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 border-b border-line">
        {tabs.map((t) => {
          const selected = t.key === active
          return (
            <button
              key={t.key}
              ref={(el) => {
                if (el) refs.current.set(t.key, el)
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.key}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.key)}
              className={`-mb-px min-h-11 border-b-2 px-3 text-[15px] font-medium transition-colors ${
                selected ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`${base}-panel-${t.key}`}
          aria-labelledby={`${base}-tab-${t.key}`}
          hidden={t.key !== active}
          tabIndex={0}
          className="pt-6 focus:outline-none focus-visible:outline-2"
        >
          {t.panel}
        </div>
      ))}
    </div>
  )
}
