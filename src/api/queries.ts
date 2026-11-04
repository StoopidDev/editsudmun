import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as api from './index'

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: async () => api.me() })
export const useClips = (from: string, to: string) =>
  useQuery({ queryKey: ['clips', from, to], queryFn: () => api.listClips(from, to) })
export const useRecent = (limit: number) => useQuery({ queryKey: ['recent', limit], queryFn: () => api.listRecent(limit) })
export const useClip = (id: string) => useQuery({ queryKey: ['clip', id], queryFn: () => api.getClip(id) })
export const useMedia = (clipId: string) => useQuery({ queryKey: ['media', clipId], queryFn: () => api.listMedia(clipId) })
export const useSearch = (q: string) => useQuery({ queryKey: ['search', q], queryFn: () => api.search(q), enabled: !!q.trim() })
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: api.listCategories })
export const useCategoryCounts = () => useQuery({ queryKey: ['categoryCounts'], queryFn: api.categoryCounts })
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: api.listUsers })
export const useStorage = (enabled: boolean) =>
  useQuery({ queryKey: ['storage'], queryFn: api.storageUsedBytes, enabled })

// shortcut: every write refetches everything; narrow the invalidation if a real backend makes this slow.
export function useAct<A, R>(fn: (arg: A) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteClip() {
  const qc = useQueryClient()
  return async (id: string) => {
    await api.softDeleteClip(id)
    await qc.invalidateQueries()
    toast('ลบคลิปแล้ว', {
      duration: 10_000,
      action: {
        label: 'เลิกทำ',
        onClick: () => void api.restoreClip(id).then(() => qc.invalidateQueries()),
      },
    })
  }
}
