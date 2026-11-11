import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react'
import type { ClipMedia } from '@/lib/types'
import type { createUploader } from './uploader'

type Uploader = ReturnType<typeof createUploader>
export const Ctx = createContext<Uploader | null>(null)
export const OfflineCtx = createContext(false)

export type UploadRow = {
  id: string; name: string; size: number; sent: number; percent: number
  paused: boolean; error: string | null; retries: number; offline: boolean
}

// Rows for one clip and purpose, read from Uppy's state. The snapshot is Uppy's own files object,
// so React only re-renders when Uppy changes it.
export function useUploads(clipId: string, purpose: ClipMedia['purpose']) {
  const uppy = useContext(Ctx)
  const offline = useContext(OfflineCtx)
  if (!uppy) throw new Error('useUploads needs UploadProvider')
  const subscribe = useCallback((cb: () => void) => { uppy.on('state-update', cb); return () => uppy.off('state-update', cb) }, [uppy])
  const getSnapshot = useCallback(() => uppy.getState().files, [uppy])
  const files = useSyncExternalStore(subscribe, getSnapshot)

  const rows: UploadRow[] = useMemo(() => Object.values(files)
    .filter((f) => f.meta.clipId === clipId && f.meta.purpose === purpose && !f.progress.uploadComplete)
    .map((f) => ({
      id: f.id, name: f.name ?? '', size: f.size ?? 0, sent: f.progress.bytesUploaded || 0,
      percent: f.progress.percentage ?? 0, paused: !!f.isPaused, error: f.error ? String(f.error) : null,
      retries: f.meta.retries ?? 0, offline,
    })), [files, clipId, purpose, offline])

  // Callers check uploadProblem first; a file that reaches here goes to the network.
  const add = (list: File[], targetClipId = clipId) => {
    for (const file of list) uppy.addFile({ name: file.name, type: file.type, data: file, meta: { clipId: targetClipId, purpose } })
  }
  return {
    rows,
    add,
    pause: (id: string) => uppy.pauseResume(id),
    retry: (id: string) => void uppy.retryUpload(id),
    remove: (id: string) => uppy.removeFile(id),
  }
}
