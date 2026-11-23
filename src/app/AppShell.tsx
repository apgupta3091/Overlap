import type { ReactNode } from 'react'
import { Logo } from '../components/Logo'

/** Page frame: skip link, header, and a centered main region. */
export function AppShell({ nav, banner, children }: { nav?: ReactNode; banner?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-50 rounded-lg bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <header className="border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          {nav}
        </div>
      </header>
      {banner}
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-10 sm:pt-8 focus:outline-none">
        {children}
      </main>
    </div>
  )
}
