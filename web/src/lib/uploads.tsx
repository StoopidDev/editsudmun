import { useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createUploader } from './uploader'
import { Ctx, OfflineCtx } from './upload-state'

// Mounted above the routes so uploads keep running while the user moves between pages.
export function UploadProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  // One uploader for the app's lifetime; it is never destroyed, only its window listeners are removed.
  // The QueryClient is a module constant in main.tsx, so capturing it once is safe.
  const [uppy] = useState(() => createUploader((m) => {
    void qc.invalidateQueries({ queryKey: ['media', m.clip_id] })
    void qc.invalidateQueries({ queryKey: ['clip', m.clip_id] }) // status may move to submitted
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
