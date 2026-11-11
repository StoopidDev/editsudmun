import { QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

// One client for main.tsx and the route loaders. Data is fresh for 30 s; writes refresh only what they change (api/queries.ts).
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (e) => toast.error(e.message) }),
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
})
