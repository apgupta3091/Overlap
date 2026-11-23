import { createContext, useContext, type ReactNode } from 'react'
import type { Repository } from './repository'

const RepoContext = createContext<Repository | null>(null)

export function RepoProvider({ repo, children }: { repo: Repository; children: ReactNode }) {
  return <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>
}

export function useRepo(): Repository {
  const repo = useContext(RepoContext)
  if (!repo) throw new Error('useRepo must be used inside <RepoProvider>')
  return repo
}
