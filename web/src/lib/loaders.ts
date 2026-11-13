import type { LoaderFunctionArgs } from 'react-router-dom'
import { supabase } from '@/api/supabase'
import { categoriesQuery, clipQuery, clipsQuery, dayCountsQuery, mediaQuery, recentQuery } from '@/api/queries'
import { calendarView, fromIso, toIso, todayIso, weekDays } from '@/lib/dates'
import { queryClient } from '@/lib/queryClient'

// Route loaders start the page's requests at navigation, in parallel with the session check, so the
// page does not wait for its data after it renders. Nothing is awaited: the page shows its own loading state.
// Signed out, nothing starts: RequireAuth sends the user to login. Prefetch errors go to the cache, not the loader.
const signedIn = async () => !!(await supabase.auth.getSession()).data.session

export async function homeLoader() {
  if (await signedIn()) {
    const days = weekDays(fromIso(todayIso()))
    void queryClient.prefetchQuery(clipsQuery(toIso(days[0]), toIso(days[6])))
    void queryClient.prefetchQuery(recentQuery(4))
    void queryClient.prefetchQuery(categoriesQuery)
  }
  return null
}

export async function calendarLoader({ request }: LoaderFunctionArgs) {
  if (await signedIn()) {
    const { view, days } = calendarView(new URL(request.url).searchParams)
    const from = toIso(days[0])
    const to = toIso(days[days.length - 1])
    if (view === 'week') void queryClient.prefetchQuery(clipsQuery(from, to))
    else void queryClient.prefetchQuery(dayCountsQuery(from, to))
    void queryClient.prefetchQuery(categoriesQuery)
  }
  return null
}

export async function clipLoader({ params }: LoaderFunctionArgs) {
  // 'new' is the create form: there is no clip to fetch.
  if (params.id && params.id !== 'new' && (await signedIn())) {
    void queryClient.prefetchQuery(clipQuery(params.id))
    void queryClient.prefetchQuery(mediaQuery(params.id))
    void queryClient.prefetchQuery(categoriesQuery)
  }
  return null
}
