import { createContext, useContext, type ReactNode } from 'react'

export interface BoardScopeValue {
  boardId: string
  /** "/demo" or "/boards/:boardId" — used to build links for both modes. */
  basePath: string
  isDemo: boolean
}

const BoardScopeContext = createContext<BoardScopeValue | null>(null)

export function BoardScopeProvider({ value, children }: { value: BoardScopeValue; children: ReactNode }) {
  return <BoardScopeContext.Provider value={value}>{children}</BoardScopeContext.Provider>
}

export function useBoardScope(): BoardScopeValue {
  const ctx = useContext(BoardScopeContext)
  if (!ctx) throw new Error('useBoardScope must be used inside a board route')
  return ctx
}

export const listingPath = (basePath: string, listingId: string) => `${basePath}/listings/${listingId}`
export const comparePath = (basePath: string, ids: readonly string[]) => `${basePath}/compare?ids=${ids.join(',')}`
export const settingsPath = (basePath: string) => `${basePath}/settings`
