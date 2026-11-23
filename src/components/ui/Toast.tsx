import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
  action?: { label: string; onClick: () => void }
}

interface ToastApi {
  show: (message: string, opts?: { kind?: ToastKind; action?: Toast['action']; durationMs?: number }) => void
  success: (message: string) => void
  error: (message: string, action?: Toast['action']) => void
  /** Screen-reader-only announcement (polite). */
  announce: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [announcement, setAnnouncement] = useState('')
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const show = useCallback<ToastApi['show']>(
    (message, opts = {}) => {
      const id = nextId.current++
      const kind = opts.kind ?? 'info'
      setToasts((t) => [...t.slice(-2), { id, kind, message, action: opts.action }])
      window.setTimeout(() => dismiss(id), opts.durationMs ?? (kind === 'error' || opts.action ? 8000 : 4000))
    },
    [dismiss],
  )

  const announce = useCallback((message: string) => {
    setAnnouncement('')
    window.setTimeout(() => setAnnouncement(message), 30)
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, { kind: 'success' }),
      error: (m, action) => show(m, { kind: 'error', action }),
      announce,
    }),
    [show, announce],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
        aria-live="polite"
        role="status"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-ink px-4 py-3 text-sm text-white shadow-raised"
          >
            {t.kind === 'success' && <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-[#9fd3b4]" />}
            {t.kind === 'error' && <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-[#f2a9a3]" />}
            <p className="flex-1">{t.message}</p>
            {t.action && (
              <button
                type="button"
                className="shrink-0 font-semibold text-[#f5c3a8] underline-offset-2 hover:underline"
                onClick={() => {
                  t.action!.onClick()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className="-m-1 rounded p-1 text-white/70 hover:text-white">
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ))}
      </div>
        </>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
