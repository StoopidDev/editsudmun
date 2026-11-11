import { keepPreviousData, useQuery } from '@tanstack/react-query'
import * as api from '@/api/index'
import type { ClipMedia } from '@/lib/types'
import { chunk } from '@/lib/media'

const EMPTY: Record<string, string> = {}

// Playback URLs for ready files of one clip, in one call. Signed URLs last 60 min, so cache 50.
// Keyed by sorted ids so the same files give the same URLs; keepPreviousData keeps a playing <video> on screen while a new set loads.
export function useViewUrls(ids: string[]) {
  const key = [...ids].sort()
  const q = useQuery({
    queryKey: ['view', key],
    queryFn: () => api.viewUrls(key),
    enabled: key.length > 0,
    placeholderData: keepPreviousData,
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
  const urls: Record<string, string> = {}
  for (const part of chunk(ids, 100)) Object.assign(urls, await api.viewUrls(part, { download: true }))
  const ready = ids.filter((id) => urls[id])
  if (!ready.length) throw new Error('ไม่มีไฟล์ให้ดาวน์โหลด')
  let started = 0
  for (const id of ready) {
    const url = urls[id]
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

