import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ClipMedia } from '@/lib/types'
import { Ctx, enqueue, OfflineCtx, type Hub, type Uploader } from './upload-state'

type Pending = { files: File[]; clipId: string; purpose: ClipMedia['purpose'] }

// Mounted above the routes so uploads keep running while the user moves between pages.
// The uploader (Uppy) is a separate chunk: it loads on the first file added, or when the browser is idle.
export function UploadProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [uppy, setUppy] = useState<Uploader | null>(null)
  const uppyRef = useRef<Uploader | null>(null)
  // Files added before the uploader exists; they go in as soon as it does.
  const pending = useRef<Pending[]>([])
  const start = useRef<() => void>(() => {})
  // Offline only flags the rows; Uppy's retryDelays do the retrying, and 'online' kicks it at once.
  const [offline, setOffline] = useState(() => !navigator.onLine)

  const add = useCallback((files: File[], clipId: string, purpose: ClipMedia['purpose']) => {
    const u = uppyRef.current
    if (u) return enqueue(u, files, clipId, purpose)
    pending.current.push({ files, clipId, purpose })
    start.current()
    return []
  }, [])

  const unfinished = useCallback(() => {
    if (pending.current.length) return true
    return !!uppyRef.current?.getFiles().some((f) => !f.progress.complete && !f.error)
  }, [])

  const cancelAll = useCallback(() => {
    pending.current = []
    uppyRef.current?.cancelAll()
  }, [])

  useEffect(() => {
    let loading = false
    let idle: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const cancelWait = () => {
      if (idle !== undefined) window.cancelIdleCallback(idle)
      clearTimeout(timer)
    }
    // One uploader for the app's lifetime; it is never destroyed, only its window listeners are removed.
    // The QueryClient is a module constant in main.tsx, so capturing it once is safe.
    start.current = () => {
      if (loading) return
      loading = true
      cancelWait()
      void import('./uploader').then(({ createUploader }) => {
        const u = createUploader((m) => {
          void qc.invalidateQueries({ queryKey: ['media', m.clip_id] })
          void qc.invalidateQueries({ queryKey: ['clip', m.clip_id] }) // status may move to submitted
        })
        uppyRef.current = u
        for (const p of pending.current) enqueue(u, p.files, p.clipId, p.purpose)
        pending.current = []
        setUppy(u)
      })
    }
    // Idle first; the 2 s bound (or the plain timer where requestIdleCallback is missing) starts it anyway.
    if ('requestIdleCallback' in window) idle = window.requestIdleCallback(() => start.current(), { timeout: 2000 })
    else timer = setTimeout(() => start.current(), 2000)

    // Leaving the tab mid-upload loses it; the browser asks first. A file still awaiting the server's check counts.
    const guard = (e: BeforeUnloadEvent) => {
      if (unfinished()) e.preventDefault()
    }
    const goOffline = () => setOffline(true)
    const goOnline = () => { setOffline(false); void uppyRef.current?.retryAll() }
    window.addEventListener('beforeunload', guard)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      cancelWait()
      window.removeEventListener('beforeunload', guard)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [qc, unfinished])

  const hub = useMemo<Hub>(() => ({ uppy, add, unfinished, cancelAll }), [uppy, add, unfinished, cancelAll])
  return <Ctx.Provider value={hub}><OfflineCtx.Provider value={offline}>{children}</OfflineCtx.Provider></Ctx.Provider>
}
