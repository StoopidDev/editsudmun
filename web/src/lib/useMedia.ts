import { useSyncExternalStore } from 'react'

// Tracks a media query, so one layout can pick a component (drawer vs sheet, rail vs full sidebar) without two trees.
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mql = matchMedia(query)
      mql.addEventListener('change', notify)
      return () => mql.removeEventListener('change', notify)
    },
    () => matchMedia(query).matches,
    () => false,
  )
}
