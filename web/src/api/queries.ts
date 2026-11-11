import { useMutation, useQuery, useQueryClient, type Query, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as api from './index'
import type { Clip, ClipCardRow } from '@/lib/types'

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: async () => api.me() })
export const useClips = (from: string, to: string, enabled = true) =>
  useQuery({ queryKey: ['clips', from, to], queryFn: () => api.listClips(from, to), enabled })
export const useRecent = (limit: number) => useQuery({ queryKey: ['recent', limit], queryFn: () => api.listRecent(limit) })
export const useClip = (id: string) => useQuery({ queryKey: ['clip', id], queryFn: () => api.getClip(id) })
export const useMedia = (clipId: string) => useQuery({ queryKey: ['media', clipId], queryFn: () => api.listMedia(clipId) })
export const useSearch = (q: string) => useQuery({ queryKey: ['search', q], queryFn: () => api.search(q), enabled: !!q.trim() })
export const useAttention = () => useQuery({ queryKey: ['attention'], queryFn: api.listAttention })
export const useExpiring = (enabled: boolean) => useQuery({ queryKey: ['expiring'], queryFn: api.listExpiring, enabled })
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: api.listCategories })
export const useCategoryCounts = () => useQuery({ queryKey: ['categoryCounts'], queryFn: api.categoryCounts })
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: api.listUsers })
export const useStorage = (enabled: boolean) =>
  useQuery({ queryKey: ['storage'], queryFn: api.storageUsedBytes, enabled })

// Writes refetch everything except playback URLs: re-signing would restart a playing video.
export const notViews = { predicate: (q: Query) => q.queryKey[0] !== 'view' }

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

// shortcut: every write refetches everything; narrow the invalidation if a real backend makes this slow.
export function useAct<A, R>(fn: (arg: A) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries(notViews),
    onError: (e: Error) => toast.error(e.message),
  })
}

// What an optimistic write changes: a structural change to each cached clip list (move, remove, re-insert)
// and/or field values on one clip (its list rows and its detail).
type Patch = {
  id: string
  rows?: (rows: ClipCardRow[], key: readonly unknown[]) => ClipCardRow[]
  set?: Partial<Clip>
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
// goes back and the error is toasted. Refetch after settle, so the server's answer wins.
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
    onSettled: () => {
      void qc.invalidateQueries(notViews)
    },
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
          else void api.restoreClip(id).then(() => qc.invalidateQueries(notViews), (e: Error) => toast.error(e.message))
        },
      },
    })
    return true
  }
}
