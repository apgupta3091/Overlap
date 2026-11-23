import { QueryClient } from '@tanstack/react-query'
import { AppError } from '../data/errors'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: true,
        refetchIntervalInBackground: false,
        // Don't retry permission/not-found errors; they won't succeed on retry.
        retry: (count, error) =>
          !(error instanceof AppError && ['forbidden', 'not_found', 'session_expired', 'unauthenticated'].includes(error.code)) && count < 2,
      },
      mutations: { retry: false },
    },
  })
}
