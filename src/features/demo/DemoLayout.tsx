import { useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { FlaskConical, RotateCcw } from 'lucide-react'
import { AppShell } from '../../app/AppShell'
import { Button, LinkButton } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { useToast } from '../../components/ui/Toast'
import { RepoProvider } from '../../data/RepoContext'
import { DemoRepository } from '../../demo/demoRepository'
import { DEMO_BOARD_ID } from '../../demo/fixtures'
import { BoardScopeProvider } from '../board/BoardScope'
import { track } from '../../lib/analytics'

export function DemoLayout() {
  const repo = useMemo(() => new DemoRepository(), [])
  const qc = useQueryClient()
  const toast = useToast()
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => track({ name: 'demo_opened' }), [])

  function reset() {
    repo.reset()
    qc.removeQueries({ queryKey: ['demo'] })
    setConfirmReset(false)
    toast.success('Demo reset to the original example board.')
  }

  const banner = (
    <div className="border-b border-warn/20 bg-warn-soft">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
        <p className="flex items-start gap-2 text-ink">
          <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
          <span>
            <strong className="font-semibold">Demo board.</strong> Apartments, links, and roommates are fictional.{' '}
            {repo.persistence === 'device'
              ? 'Your changes are saved only in this browser.'
              : 'Browser storage is unavailable, so changes will be lost when you close this tab.'}
          </span>
        </p>
        <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)} icon={<RotateCcw aria-hidden className="size-4" />}>
          Reset demo
        </Button>
      </div>
    </div>
  )

  return (
    <RepoProvider repo={repo}>
      <BoardScopeProvider value={{ boardId: DEMO_BOARD_ID, basePath: '/demo', isDemo: true }}>
        <AppShell
          banner={banner}
          nav={
            <LinkButton to="/login?mode=signup" size="sm" variant="primary">
              Create your board
            </LinkButton>
          }
        >
          <Outlet />
        </AppShell>
        <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset the demo?" size="sm" description="This erases the listings, votes, notes, and photos you added to the demo on this device.">
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="danger" onClick={reset}>Reset demo</Button>
          </div>
        </Dialog>
      </BoardScopeProvider>
    </RepoProvider>
  )
}
