import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createUploader } from './uploader'
import { Ctx, OfflineCtx } from './upload-state'

// Mounted above the routes so uploads keep running while the user moves between pages.
export function UploadProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const qcRef = useRef(qc)
  useEffect(() => { qcRef.current = qc }, [qc])
  // One uploader for the app's lifetime; it is never destroyed, only its window listeners are removed.
  // onReady reads the client through the ref at call time, so it never holds a stale QueryClient.
  const [uppy] = useState(() => createUploader((m) => {
    void qcRef.current.invalidateQueries({ queryKey: ['media', m.clip_id] })
    void qcRef.current.invalidateQueries({ queryKey: ['clip', m.clip_id] }) // status may move to submitted
  }))
  // Offline only flags the rows; Uppy's retryDelays do the retrying, and 'online' kicks it at once.
  const [offline, setOffline] = useState(() => !navigator.onLine)

  useEffect(() => {
    // Leaving the tab mid-upload loses it; the browser asks first. A file still awaiting the server's check counts.
    const guard = (e: BeforeUnloadEvent) => {
      if (uppy.getFiles().some((f) => !f.progress.complete && !f.error)) e.preventDefault()
    }
    const goOffline = () => setOffline(true)
    const goOnline = () => { setOffline(false); void uppy.retryAll() }
    window.addEventListener('beforeunload', guard)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('beforeunload', guard)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [uppy])

  return <Ctx.Provider value={uppy}><OfflineCtx.Provider value={offline}>{children}</OfflineCtx.Provider></Ctx.Provider>
}
