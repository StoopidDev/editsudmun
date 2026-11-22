import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { Pause, Play, RotateCw, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ACCEPT, progressLabel, uploadProblem, uploadStatus } from '@/lib/media'
import type { ClipMedia } from '@/lib/types'
import { dialogOpen } from '@/lib/shortcut'
import { useUploads, type UploadRow } from '@/lib/upload-state'

const COPY = {
  reference: { title: 'ลากรูปหรือวิดีโอมาวาง หรือคลิกเพื่อเลือกไฟล์', hint: 'รูปภาพ และวิดีโอ MP4 / MOV ไม่เกิน 2 GB', drop: 'วางไฟล์เพื่อแนบเป็นไฟล์อ้างอิง' },
  submission: { title: 'ลากไฟล์มาวาง หรือ คลิกเพื่อเลือกไฟล์', hint: 'ถ้าเน็ตหลุดระหว่างอัป จะอัปต่อจากเดิมได้', drop: 'วางไฟล์เพื่อส่งงาน' },
} as const

// Copy for a file refused before upload (Figma 103:2720, 102:2384).
function refusedCopy(problem: string, purpose: ClipMedia['purpose']) {
  if (problem === 'ไม่รองรับไฟล์ชนิดนี้') return 'ไม่รองรับไฟล์ชนิดนี้ อัปได้เฉพาะรูปภาพและวิดีโอ'
  if (problem === 'วิดีโอใหญ่เกิน 2 GB' && purpose === 'submission')
    return 'ไฟล์ใหญ่เกิน 2 GB ส่งได้เฉพาะไฟล์ที่ตัดต่อเสร็จแล้ว (MP4 H.264 ไม่เกิน 1080p)'
  return problem
}

type Refused = { key: number; name: string; message: string; tooBig: boolean }

export function UploadZone({ clipId, purpose, ensureClipId, parked = [], setParked }: {
  clipId: string
  purpose: ClipMedia['purpose']
  // Called when a file arrives before the clip is saved (add clip, D2); returns the new clip id.
  ensureClipId?: () => Promise<string | null>
  // Files waiting for a new clip. The form owns them, so they go away with the unsaved form.
  parked?: File[]
  setParked?: Dispatch<SetStateAction<File[]>>
}) {
  const { rows, add, pause, retry, remove } = useUploads(clipId, purpose)
  // A file is being dragged over the window: the whole page is the drop target, not only the small zone.
  const [over, setOver] = useState(false)
  const depth = useRef(0)
  const [refused, setRefused] = useState<Refused[]>([])
  const [leaving, setLeaving] = useState<UploadRow[]>([])
  const [announce, setAnnounce] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)
  const scope = useRef('')
  const prev = useRef<UploadRow[]>([])
  const cancelled = useRef(new Set<string>())
  const reported = useRef(new Set<string>())

  // Rows that vanish without a cancel have finished: fade them out and announce it.
  useEffect(() => {
    const key = `${clipId}|${purpose}`
    if (scope.current !== key) { scope.current = key; prev.current = []; return }
    const ids = new Set(rows.map((r) => r.id))
    const done = prev.current.filter((r) => !ids.has(r.id) && !cancelled.current.has(r.id))
    prev.current = rows
    if (done.length) {
      setLeaving((l) => [...l, ...done.map((r) => ({ ...r, sent: r.size, percent: 100 }))])
      setAnnounce(`อัปโหลด ${done[done.length - 1].name} เสร็จแล้ว`)
    }
  }, [rows, clipId, purpose])

  // Announce each failure once; a retry that succeeds clears the flag so the next failure is heard.
  useEffect(() => {
    for (const r of rows) {
      if (!r.error) reported.current.delete(r.id)
      else if (!reported.current.has(r.id)) {
        reported.current.add(r.id)
        setAnnounce(`อัปโหลด ${r.name} ไม่สำเร็จ`)
      }
    }
  }, [rows])

  const onFiles = async (list: FileList | File[]) => {
    const bad: Refused[] = []
    const good: File[] = []
    for (const f of Array.from(list)) {
      const problem = uploadProblem(f)
      if (problem) bad.push({ key: ++seq.current, name: f.name, message: refusedCopy(problem, purpose), tooBig: problem.includes('ใหญ่เกิน') })
      else good.push(f)
    }
    // Refused files never reach Uppy or the network.
    if (bad.length) { setRefused((r) => [...r, ...bad]); setAnnounce(bad[0].message) }
    if (!good.length) return
    const id = clipId || (await ensureClipId?.()) || ''
    if (!id) { setParked?.((p) => [...p, ...good]); return }
    addFiles(good, id)
  }

  const addFiles = (list: File[], id: string) => {
    const failed = add(list, id)
    if (failed.length) {
      setRefused((r) => [...r, ...failed.map((f) => ({ key: ++seq.current, name: f.name, message: f.message, tooBig: false }))])
      setAnnounce(failed[0].message)
    }
  }

  const cancel = (id: string) => { cancelled.current.add(id); remove(id) }

  // Bound on every render so the drop sees the current clip id. dragenter and dragleave fire for every element crossed, so they are counted.
  useEffect(() => {
    const files = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
    // A disabled form (draft banner) or an open dialog takes no files, but the drop is still cancelled: otherwise the browser opens the file and leaves the app.
    const live = (e: DragEvent) => files(e) && !inputRef.current?.matches(':disabled') && !dialogOpen()
    const enter = (e: DragEvent) => { if (live(e)) { depth.current++; setOver(true) } }
    const leave = (e: DragEvent) => { if (files(e) && (depth.current = Math.max(0, depth.current - 1)) === 0) setOver(false) }
    const hover = (e: DragEvent) => { if (files(e)) e.preventDefault() }
    const drop = (e: DragEvent) => {
      if (!files(e)) return
      e.preventDefault()
      depth.current = 0
      setOver(false)
      if (live(e) && e.dataTransfer) void onFiles(e.dataTransfer.files)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', hover)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', hover)
      window.removeEventListener('drop', drop)
    }
  })

  return (
    <div className="flex flex-col gap-2">
      <label className="flex min-h-15 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-card border border-dashed border-line bg-surface px-3 py-2 text-center text-xs transition-colors duration-200 hover-pointer:border-brand hover-pointer:bg-today focus-within:ring-2 focus-within:ring-brand/50">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => { void onFiles(e.target.files ?? []); e.target.value = '' }}
        />
        <Upload size={18} className="text-sub" aria-hidden />
        <span className="text-ink">{COPY[purpose].title}</span>
        <span className="text-sub">{COPY[purpose].hint}</span>
      </label>

      {[...rows, ...leaving].map((r) => (
        <Row
          key={r.id}
          row={r}
          leaving={leaving.includes(r)}
          onLeft={() => setLeaving((l) => l.filter((x) => x.id !== r.id))}
          onPause={() => pause(r.id)}
          onRetry={() => retry(r.id)}
          onRemove={() => cancel(r.id)}
        />
      ))}

      {refused.map((f) => (
        <div key={f.key} className="flex flex-col gap-1 rounded-card border border-danger bg-danger/10 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-bold text-ink">{f.name}</span>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => setRefused((r) => r.filter((x) => x.key !== f.key))}><X size={14} aria-hidden />ลบออก</Button>
          </div>
          <span className="text-xs text-danger">{f.message}</span>
          {f.tooBig && (
            <Button variant="outline" size="sm" className="self-start text-brand-text"
              onClick={() => { setRefused((r) => r.filter((x) => x.key !== f.key)); inputRef.current?.click() }}><Upload size={14} aria-hidden />เลือกไฟล์ใหม่</Button>
          )}
        </div>
      ))}

      {parked.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-warn-text">กรอกหัวข้อก่อนแนบไฟล์ · ไฟล์จะเริ่มอัปเมื่อบันทึกคลิป</p>
          {parked.map((f, i) => (
            <div key={`${i}-${f.name}`} className="flex items-baseline justify-between gap-2 rounded-card border border-line bg-surface p-3">
              <span className="truncate text-sm text-ink">{f.name}</span>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => setParked?.((p) => p.filter((_, j) => j !== i))}><X size={14} aria-hidden />ลบออก</Button>
            </div>
          ))}
        </div>
      )}

      {over && createPortal(
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-black/40 p-6 backdrop-blur-sm duration-150 animate-in fade-in-0">
          <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-xl border-2 border-dashed border-brand bg-bg p-10 text-center duration-150 animate-in zoom-in-95">
            <Upload size={32} className="text-brand" aria-hidden />
            <b className="text-lg text-ink">{COPY[purpose].drop}</b>
            <span className="text-sm text-sub">{COPY[purpose].hint}</span>
          </div>
        </div>,
        document.body,
      )}

      <div aria-live="polite" className="sr-only">{announce}</div>
    </div>
  )
}

function Row({ row, leaving, onLeft, onPause, onRetry, onRemove }: {
  row: UploadRow; leaving: boolean; onLeft: () => void
  onPause: () => void; onRetry: () => void; onRemove: () => void
}) {
  const status = uploadStatus(row)
  const failed = status === 'failed'
  const warn = status === 'retrying'
  const tone = failed ? 'border-danger bg-danger/10' : warn ? 'border-warn-text bg-warn-bg' : 'border-transparent bg-today'
  const bar = failed ? 'bg-danger' : warn ? 'bg-warn-text' : 'bg-brand'
  const right = failed ? `อัปไม่สำเร็จที่ ${row.percent}%`
    : warn ? `${row.offline ? 'เน็ตหลุด · ' : ''}กำลังลองใหม่ (ครั้งที่ ${Math.max(1, row.retries)})`
    : progressLabel(row.sent, row.size)

  return (
    <div
      className={`flex flex-col gap-2 rounded-card border p-3 transition-colors duration-200 ${tone} ${leaving ? 'pointer-events-none animate-[row-out_200ms_ease-out_forwards]' : ''}`}
      onAnimationEnd={leaving ? onLeft : undefined}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-bold text-ink">{row.name}</span>
        <span className={`shrink-0 text-xs tabular-nums ${failed ? 'text-danger' : warn ? 'text-warn-text' : 'text-sub'}`}>{right}</span>
      </div>
      <div role="progressbar" aria-label={`อัปโหลด ${row.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.percent}
        className="h-1.5 overflow-hidden rounded-full bg-grid">
        <div className={`h-full rounded-full transition-[width] duration-200 ease-linear ${bar}`} style={{ width: `${row.percent}%` }} />
      </div>
      {!leaving && (
        <div className="flex flex-wrap gap-2">
          {failed ? (
            <>
              <Button variant="outline" size="sm" className="text-brand-text" onClick={onRetry}><RotateCw size={14} aria-hidden />อัปต่อจากเดิม</Button>
              <Button variant="outline" size="sm" className="text-danger" onClick={onRemove}><X size={14} aria-hidden />ยกเลิกไฟล์นี้</Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="text-brand-text" onClick={onPause}>{row.paused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}{row.paused ? 'อัปต่อ' : 'หยุดชั่วคราว'}</Button>
              <Button variant="outline" size="sm" className="text-danger" onClick={onRemove}><X size={14} aria-hidden />ยกเลิก</Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
