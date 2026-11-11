import { useQuery } from '@tanstack/react-query'
import * as api from '@/api/index'
import type { ClipMedia } from '@/lib/types'

const EMPTY: Record<string, string> = {}

// Playback or download URLs for ready files of one clip, in one call. Signed URLs last 60 min, so cache 50.
export function useViewUrls(ids: string[], download = false) {
  const key = [...ids].sort()
  const q = useQuery({
    queryKey: ['view', download, key],
    queryFn: () => api.viewUrls(key, { download }),
    enabled: key.length > 0,
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
  })
  return q.data ?? EMPTY
}

export type Viewable = { id: string; file_name: string; kind: ClipMedia['kind']; mime: string; url: string }

// Ready files that already have a URL, in list order: what the lightbox can page through.
export const viewables = (files: ClipMedia[], urls: Record<string, string>): Viewable[] =>
  files.filter((f) => f.status === 'ready' && urls[f.id]).map((f) => ({ id: f.id, file_name: f.file_name, kind: f.kind, mime: f.mime, url: urls[f.id] }))

// Single file: the signed URL carries Content-Disposition with the Thai name, so navigating to it downloads.
export async function downloadOne(id: string) {
  const url = (await api.viewUrls([id], { download: true }))[id]
  if (!url) throw new Error('ไม่พบไฟล์')
  window.location.assign(url)
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Browsers block a burst of downloads, so each file starts 400 ms after the previous one.
export async function downloadAll(ids: string[]) {
  const urls = await api.viewUrls(ids, { download: true })
  let started = 0
  for (const id of ids) {
    const url = urls[id]
    if (!url) continue
    if (started++) await wait(400)
    const a = document.createElement('a')
    a.href = url
    a.download = ''
    a.hidden = true
    document.body.append(a)
    a.click()
    a.remove()
  }
  return started
}

