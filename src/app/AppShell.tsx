import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '../components/Logo'

/** Page frame: skip link, slim header, centered main region, minimal footer. */
export function AppShell({ nav, banner, children }: { nav?: ReactNode; banner?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-50 rounded-lg bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <header className="border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Logo />
          {nav}
        </div>
      </header>
      {banner}
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-12 sm:pt-8 focus:outline-none">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-ink-faint">
          <span>No accounts required.</span>
          <Link to="/privacy" className="rounded underline-offset-2 hover:text-ink hover:underline">Privacy</Link>
        </div>
      </footer>
    </div>
  )
}
