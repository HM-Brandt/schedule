import { MutationCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'

export function mutationErrorMessage(error: unknown): string {
  return error instanceof ApiError && error.message
    ? `No se pudo guardar el cambio. ${error.message}`
    : 'No se pudo guardar el cambio.'
}

export function createQueryClient(options?: { onMutationError?: (message: string) => void }) {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => options?.onMutationError?.(mutationErrorMessage(error)),
    }),
  })
}
