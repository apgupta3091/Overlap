import { QueryClient } from '@tanstack/react-query'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: true,
        // Never poll in hidden tabs.
        refetchIntervalInBackground: false,
        retry: (count) => count < 2,
      },
      mutations: { retry: false },
    },
  })
}
