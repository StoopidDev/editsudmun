import { useMutation, useQuery, useQueryClient, type Query } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as api from './index'

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

// shortcut: every write refetches everything; narrow the invalidation if a real backend makes this slow.
export function useAct<A, R>(fn: (arg: A) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries(notViews),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteClip(onDeleted?: () => void) {
  const qc = useQueryClient()
  return async (id: string): Promise<boolean> => {
    try {
      await api.softDeleteClip(id)
    } catch (e) {
      toast.error((e as Error).message)
      return false
    }
    onDeleted?.()
    await qc.invalidateQueries(notViews)
    toast('ลบคลิปแล้ว', {
      duration: 10_000,
      action: {
        label: 'เลิกทำ',
        onClick: async () => {
          try {
            await api.restoreClip(id)
            await qc.invalidateQueries(notViews)
          } catch (e) {
            toast.error((e as Error).message)
          }
        },
      },
    })
    return true
  }
}
