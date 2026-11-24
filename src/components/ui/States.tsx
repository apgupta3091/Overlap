import type { ReactNode } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-ink-muted">
      <Loader2 aria-hidden className="size-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  level = 2,
}: {
  icon?: ReactNode
  level?: 1 | 2
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
      {icon && <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-sunken text-ink-muted">{icon}</div>}
      <Heading level={level}>{title}</Heading>
      {children && <div className="mt-2 text-[15px] text-ink-muted">{children}</div>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  action,
  level = 2,
}: {
  title?: string
  message: string
  action?: ReactNode
  level?: 1 | 2
}) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-bad-soft text-bad">
        <AlertTriangle aria-hidden className="size-6" />
      </div>
      <Heading level={level}>{title}</Heading>
      <p className="mt-2 text-[15px] text-ink-muted">{message}</p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  )
}

function Heading({ level, children }: { level: 1 | 2; children: ReactNode }) {
  const Tag = level === 1 ? 'h1' : 'h2'
  return <Tag className="text-lg font-semibold text-ink">{children}</Tag>
}
