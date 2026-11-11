// The session query and the write-refetch filter, without the rest of the data hooks: the login
// route and its guards import this file only.
import { useQuery, type Query } from '@tanstack/react-query'
import * as api from './auth'

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: async () => api.me() })

// Writes refetch everything except playback URLs: re-signing would restart a playing video.
export const notViews = { predicate: (q: Query) => q.queryKey[0] !== 'view' }
