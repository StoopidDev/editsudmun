import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react'
import type { ClipMedia } from '@/lib/types'
// Type-only: this module must not pull Uppy in, since the app shell imports it on every page.
import type { createUploader } from './uploader'

export type Uploader = ReturnType<typeof createUploader>
type Files = ReturnType<Uploader['getState']>['files']
export type Refused = { name: string; message: string }

// What the screens may do with uploads. `uppy` is null until the uploader chunk has loaded;
// `add` queues files until then, and the cancel/unfinished calls cover queued files too.
export type Hub = {
  uppy: Uploader | null
  add: (list: File[], clipId: string, purpose: ClipMedia['purpose']) => Refused[]
  unfinished: () => boolean
  cancelAll: () => void
}

export const Ctx = createContext<Hub | null>(null)
export const OfflineCtx = createContext(false)

export type UploadRow = {
  id: string; name: string; size: number; sent: number; percent: number
  paused: boolean; error: string | null; retries: number; offline: boolean
}

const NO_FILES = {} as Files

// Rows for one clip and purpose, read from Uppy's state. The snapshot is Uppy's own files object,
// so React only re-renders when Uppy changes it. A row that failed to confirm stays visible.
// Until the uploader loads there are no rows; add() still accepts files.
export function useUploads(clipId: string, purpose: ClipMedia['purpose']) {
  const hub = useContext(Ctx)
  const offline = useContext(OfflineCtx)
  if (!hub) throw new Error('useUploads needs UploadProvider')
  const uppy = hub.uppy
  const subscribe = useCallback((cb: () => void) => {
    if (!uppy) return () => {}
    uppy.on('state-update', cb)
    return () => uppy.off('state-update', cb)
  }, [uppy])
  const getSnapshot = useCallback(() => uppy?.getState().files ?? NO_FILES, [uppy])
  const files = useSyncExternalStore(subscribe, getSnapshot)

  const rows: UploadRow[] = useMemo(() => Object.values(files)
    .filter((f) => f.meta.clipId === clipId && f.meta.purpose === purpose && (!f.progress.uploadComplete || !!f.error))
    .map((f) => ({
      id: f.id, name: f.name ?? '', size: f.size ?? 0, sent: f.progress.bytesUploaded || 0,
      percent: f.progress.percentage ?? 0, paused: !!f.isPaused, error: f.error ? String(f.error) : null,
      retries: f.meta.retries ?? 0, offline,
    })), [files, clipId, purpose, offline])

  // Callers check uploadProblem first. Returns the files Uppy refused (e.g. a restriction), with why.
  return {
    rows,
    add: (list: File[], targetClipId = clipId) => hub.add(list, targetClipId, purpose),
    pause: (id: string) => uppy?.pauseResume(id),
    retry: (id: string) => { if (uppy) void import('./uploader').then((m) => m.retryFile(uppy, id)) },
    remove: (id: string) => uppy?.removeFile(id),
  }
}

// Adds files to Uppy for one clip. Returns the files Uppy refused, with why.
export function enqueue(uppy: Uploader, list: File[], clipId: string, purpose: ClipMedia['purpose']) {
  const refused: Refused[] = []
  for (const file of list) {
    try {
      uppy.addFile({
        id: `${clipId}:${purpose}:${crypto.randomUUID()}`,
        name: file.name, type: file.type, data: file, meta: { clipId, purpose },
      })
    } catch (e) {
      refused.push({ name: file.name, message: e instanceof Error ? e.message : 'เพิ่มไฟล์ไม่สำเร็จ' })
    }
  }
  return refused
}
