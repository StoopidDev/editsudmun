import { seed, type DB } from './seed'

const KEY = 'fake-db-v1'
let cache: DB | null = null

export function db(): DB {
  if (cache) return cache
  const raw = localStorage.getItem(KEY)
  cache = raw ? (JSON.parse(raw) as DB) : seed()
  return cache
}

export const save = () => localStorage.setItem(KEY, JSON.stringify(cache))

export function resetDb() {
  localStorage.removeItem(KEY)
  cache = null
}
