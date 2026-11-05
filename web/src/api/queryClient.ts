import { MutationCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'

export function mutationErrorMessage(error: unknown): string {
  return error instanceof ApiError && error.message
    ? `Couldn't save the change. ${error.message}`
    : "Couldn't save the change."
}

export function createQueryClient(options?: { onMutationError?: (message: string) => void }) {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => options?.onMutationError?.(mutationErrorMessage(error)),
    }),
  })
}
