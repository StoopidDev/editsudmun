import { seed, type DB } from './seed'

const KEY = 'fake-db-v2'
let cache: DB | null = null

// Another tab wrote the store: drop the cache so the next read reloads it.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) cache = null
  })
}

export function db(): DB {
  if (cache) return cache
  const raw = localStorage.getItem(KEY)
  try {
    cache = raw ? (JSON.parse(raw) as DB) : seed()
  } catch {
    cache = seed()
  }
  return cache
}

export const save = () => localStorage.setItem(KEY, JSON.stringify(cache))

export function resetDb() {
  localStorage.removeItem(KEY)
  cache = null
}
