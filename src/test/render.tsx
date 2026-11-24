import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { ToastProvider } from '../components/ui/Toast'
import { ClientProvider, type OverlapClient } from '../data/client'
import { LocalEventService } from '../data/localService'
import { memoryStore } from '../data/store'
import { routes } from '../app/routes'

export function testClient(): OverlapClient {
  const store = memoryStore()
  return { id: `test-${Math.random()}`, service: new LocalEventService(store), store, localOnly: true, demo: false }
}

export function Providers({ client, children }: { client?: OverlapClient; children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const inner = client ? <ClientProvider client={client}>{children}</ClientProvider> : children
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>{inner}</ToastProvider>
    </QueryClientProvider>
  )
}

export function renderRoute(path: string, client?: OverlapClient, routeList: RouteObject[] = routes) {
  const router = createMemoryRouter(routeList, { initialEntries: [path] })
  const result = render(
    <Providers client={client}>
      <RouterProvider router={router} />
    </Providers>,
  )
  return { ...result, router }
}
