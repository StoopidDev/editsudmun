import { queryOptions, skipToken, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as api from './index'
import { useMe } from './queries-auth'
import type { Clip, ClipCardRow } from '@/lib/types'

export { useMe }

// Query options: the hooks below and the route loaders (router.tsx) share them, so a prefetch fills the hook's entry.
export const clipsQuery = (from: string, to: string) =>
  queryOptions({ queryKey: ['clips', from, to], queryFn: () => api.listClips(from, to) })
export const dayCountsQuery = (from: string, to: string) =>
  queryOptions({ queryKey: ['dayCounts', from, to], queryFn: () => api.listDayCounts(from, to) })
export const clipQuery = (id: string) => queryOptions({ queryKey: ['clip', id], queryFn: () => api.getClip(id) })
export const mediaQuery = (id: string) => queryOptions({ queryKey: ['media', id], queryFn: () => api.listMedia(id) })
export const recentQuery = (limit: number) => queryOptions({ queryKey: ['recent', limit], queryFn: () => api.listRecent(limit) })
export const categoriesQuery = queryOptions({ queryKey: ['categories'], queryFn: api.listCategories, staleTime: 5 * 60_000 })

export const useClips = (from: string, to: string, enabled = true) => useQuery({ ...clipsQuery(from, to), enabled })
export const useDayCounts = (from: string, to: string, enabled = true) => useQuery({ ...dayCountsQuery(from, to), enabled })
export const useRecent = (limit: number) => useQuery(recentQuery(limit))
export const useClip = (id: string) => useQuery(clipQuery(id))
export const useMedia = (clipId: string) => useQuery(mediaQuery(clipId))
export const useSearch = (q: string) => useQuery({ queryKey: ['search', q], queryFn: () => api.search(q), enabled: !!q.trim() })
// Owner and creator see different lists, so the role is part of the key. No role yet, no request.
export const useAttention = () => {
  const { data: me } = useMe()
  const role = me?.role
  return useQuery({ queryKey: ['attention', role], queryFn: role ? () => api.listAttention(role) : skipToken })
}
export const useExpiring = (enabled: boolean) => useQuery({ queryKey: ['expiring'], queryFn: api.listExpiring, enabled })
export const useCategories = () => useQuery(categoriesQuery)
export const useCategoryCounts = () => useQuery({ queryKey: ['categoryCounts'], queryFn: api.categoryCounts })
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: api.listUsers })
export const useStorage = (enabled: boolean) =>
  useQuery({ queryKey: ['storage'], queryFn: api.storageUsedBytes, enabled })

// View Transitions animate whatever the update changes (FLIP for free). No-op where unsupported or under reduced motion.
let vtRun = 0
export async function withTransition(update: () => void) {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return update()
  const run = ++vtRun
  document.documentElement.dataset.vt = 'local'
  const t = document.startViewTransition(async () => { update(); await new Promise((r) => setTimeout(r)) }) // TanStack notifies via setTimeout(0)
  // Only the latest run clears the flag, or rapid moves would bring the root crossfade back mid-animation.
  t.finished.catch(() => {}).finally(() => { if (run === vtRun) delete document.documentElement.dataset.vt })
  await t.updateCallbackDone.catch(() => {})
}

// The lists a clip write can change. 'view' (signed playback URLs) is never listed, so a playing video keeps its URL.
export const CLIP_KEYS = [['clips'], ['clip'], ['dayCounts'], ['categoryCounts'], ['attention'], ['recent'], ['media'], ['search'], ['expiring'], ['storage']] as const
type Keys = readonly (readonly unknown[])[]
const refresh = (qc: QueryClient, keys: Keys) => {
  for (const queryKey of keys) void qc.invalidateQueries({ queryKey })
}

// Each caller names the lists its write changes; the default is the clip lists.
export function useAct<A, R>(fn: (arg: A) => Promise<R>, keys: Keys = CLIP_KEYS) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => refresh(qc, keys),
    onError: (e: Error) => toast.error(e.message),
  })
}

// What an optimistic write changes: a structural change to each cached clip list (move, remove, re-insert)
// and/or field values on one clip (its list rows and its detail).
type Patch = {
  id: string
  rows?: (rows: ClipCardRow[], key: readonly unknown[]) => ClipCardRow[]
  // Generated columns (script_preview, has_note) are left out: the server computes them, and the refetch after settle brings them.
  set?: Partial<Omit<Clip, 'script_preview' | 'has_note'>>
}
type Snap = [readonly unknown[], unknown][]

function snapshot(qc: QueryClient, id: string): Snap {
  return [...qc.getQueriesData({ queryKey: ['clips'] }), ...qc.getQueriesData({ queryKey: ['clip', id] })]
}

function restore(qc: QueryClient, snap: Snap) {
  for (const [key, data] of snap) qc.setQueryData(key, data)
}

function apply(qc: QueryClient, p: Patch) {
  for (const [key, rows] of qc.getQueriesData<ClipCardRow[]>({ queryKey: ['clips'] })) {
    if (!rows) continue
    let next = p.rows ? p.rows(rows, key) : rows
    if (p.set) next = next.map((r) => (r.id === p.id ? { ...r, ...p.set } : r))
    qc.setQueryData(key, next)
  }
  if (p.set) qc.setQueryData<Clip | null>(['clip', p.id], (c) => (c ? { ...c, ...p.set } : c))
}

// Every clip write shows at once in one View Transition; the server only confirms it. On error the cache
// goes back and the error is toasted. Refetch after settle, so the server's answer wins. Month counts
// ('dayCounts') are not patched; they refetch on settle with the other clip lists.
// scope: writes in the same scope run one after another (move twice in a row keeps both).
export function useOptimisticAct<A>(fn: (a: A) => Promise<unknown>, patch: (a: A) => Patch, scope?: { id: string }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    scope,
    onMutate: async (a: A) => {
      const p = patch(a)
      await Promise.all([qc.cancelQueries({ queryKey: ['clips'] }), qc.cancelQueries({ queryKey: ['clip', p.id] })])
      const before = snapshot(qc, p.id)
      await withTransition(() => apply(qc, p))
      return { before }
    },
    onError: (e: Error, _a, ctx) => {
      if (ctx) restore(qc, ctx.before)
      toast.error(e.message)
    },
    onSettled: () => refresh(qc, CLIP_KEYS),
  })
}

function findRow(qc: QueryClient, id: string): ClipCardRow | undefined {
  for (const [, rows] of qc.getQueriesData<ClipCardRow[]>({ queryKey: ['clips'] })) {
    const row = rows?.find((r) => r.id === id)
    if (row) return row
  }
  return undefined
}

// Puts a restored row back into a list that covers its day, in its place by day and position.
function insertRow(rows: ClipCardRow[], row: ClipCardRow, key: readonly unknown[]): ClipCardRow[] {
  const [, from, to] = key as string[]
  if (rows.some((r) => r.id === row.id) || row.date < from || row.date > to) return rows
  return [...rows, row].sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position)
}

// The card collapses at once; the request follows; 'เลิกทำ' puts the same row back in place.
export function useDeleteClip(onDeleted?: () => void) {
  const qc = useQueryClient()
  const remove = useOptimisticAct((id: string) => api.softDeleteClip(id), (id) => ({
    id,
    rows: (rows) => rows.filter((r) => r.id !== id),
  }))
  const undoDelete = useOptimisticAct((row: ClipCardRow) => api.restoreClip(row.id), (row) => ({
    id: row.id,
    rows: (rows, key) => insertRow(rows, row, key),
  }))
  return async (id: string): Promise<boolean> => {
    const row = findRow(qc, id)
    try {
      await remove.mutateAsync(id)
    } catch {
      return false // useOptimisticAct already rolled back and toasted
    }
    onDeleted?.()
    toast('ลบคลิปแล้ว', {
      duration: 10_000,
      action: {
        label: 'เลิกทำ',
        onClick: () => {
          if (row) undoDelete.mutate(row)
          else void api.restoreClip(id).then(() => refresh(qc, CLIP_KEYS), (e: Error) => toast.error(e.message))
        },
      },
    })
    return true
  }
}
