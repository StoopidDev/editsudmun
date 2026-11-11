import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createUploader } from './uploader'
import { Ctx, OfflineCtx } from './upload-state'

// Mounted above the routes so uploads keep running while the user moves between pages.
export function UploadProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const uppy = useMemo(() => createUploader((m) => {
    void qc.invalidateQueries({ queryKey: ['media', m.clip_id] })
    void qc.invalidateQueries({ queryKey: ['clip', m.clip_id] }) // status may move to submitted
  }), [qc])
  // Offline only flags the rows; Uppy's retryDelays do the retrying, and 'online' kicks it at once.
  const [offline, setOffline] = useState(() => !navigator.onLine)

  useEffect(() => {
    // Leaving the tab mid-upload loses it; the browser asks first.
    const guard = (e: BeforeUnloadEvent) => {
      if (uppy.getFiles().some((f) => !f.progress.uploadComplete && !f.error)) e.preventDefault()
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
      uppy.destroy()
    }
  }, [uppy])

  return <Ctx.Provider value={uppy}><OfflineCtx.Provider value={offline}>{children}</OfflineCtx.Provider></Ctx.Provider>
}

