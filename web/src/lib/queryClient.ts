import { QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/api/supabase'

// One client for main.tsx and the route loaders. Data is fresh for 30 s; writes refresh only what they change (api/queries.ts).
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (e) => toast.error(e.message) }),
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
})

// A session that dies in an open tab (revoked, user deleted) must send the user to login.
// `me: null` makes RequireAuth redirect; the rest of the cache is dropped so no page shows old data.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    queryClient.setQueryData(['me'], null)
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
  }
})
