import { useEffect, useRef, useState, type DragEvent } from 'react'
import { ACCEPT, progressLabel, uploadProblem, uploadStatus } from '@/lib/media'
import type { ClipMedia } from '@/lib/types'
import { parkedCount, park, takeParked, useUploads, type UploadRow } from '@/lib/upload-state'

const COPY = {
  reference: { title: 'ลากรูปหรือวิดีโอมาวาง หรือคลิกเพื่อเลือกไฟล์', hint: 'รูปภาพ และวิดีโอ MP4 / MOV ไม่เกิน 2 GB' },
  submission: { title: 'ลากไฟล์มาวาง หรือ คลิกเพื่อเลือกไฟล์', hint: 'ถ้าเน็ตหลุดระหว่างอัป จะอัปต่อจากเดิมได้' },
} as const

// Copy for a file refused before upload (Figma 103:2720, 102:2384).
function refusedCopy(problem: string, purpose: ClipMedia['purpose']) {
  if (problem === 'ไม่รองรับไฟล์ชนิดนี้') return 'ไม่รองรับไฟล์ชนิดนี้ อัปได้เฉพาะรูปภาพและวิดีโอ'
  if (problem === 'วิดีโอใหญ่เกิน 2 GB' && purpose === 'submission')
    return 'ไฟล์ใหญ่เกิน 2 GB ส่งได้เฉพาะไฟล์ที่ตัดต่อเสร็จแล้ว (MP4 H.264 ไม่เกิน 1080p)'
  return problem
}

type Refused = { key: number; name: string; message: string; tooBig: boolean }

export function UploadZone({ clipId, purpose, ensureClipId }: {
  clipId: string
  purpose: ClipMedia['purpose']
  // Called when a file arrives before the clip is saved (add clip, D2); returns the new clip id.
  ensureClipId?: () => Promise<string | null>
}) {
  const { rows, add, pause, retry, remove } = useUploads(clipId, purpose)
  const [over, setOver] = useState(false)
  const [refused, setRefused] = useState<Refused[]>([])
  const [leaving, setLeaving] = useState<UploadRow[]>([])
  const [announce, setAnnounce] = useState('')
  const [, bumpParked] = useState(0)
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
    if (!id) { park(purpose, good); bumpParked((n) => n + 1); return }
    addFiles(good, id)
  }

  const addFiles = (list: File[], id: string) => {
    const failed = add(list, id)
    if (failed.length) {
      setRefused((r) => [...r, ...failed.map((f) => ({ key: ++seq.current, name: f.name, message: f.message, tooBig: false }))])
      setAnnounce(failed[0].message)
    }
  }

  // Files parked before the clip existed start as soon as it does.
  useEffect(() => {
    if (!clipId) return
    const waiting = takeParked(purpose)
    if (waiting.length) addFiles(waiting, clipId)
  })

  const cancel = (id: string) => { cancelled.current.add(id); remove(id) }

  return (
    <div className="flex flex-col gap-2">
      <label
        onDragOver={(e: DragEvent) => { e.preventDefault(); setOver(true) }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false) }}
        onDrop={(e: DragEvent) => { e.preventDefault(); setOver(false); void onFiles(e.dataTransfer.files) }}
        className={`flex h-15 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-card border bg-surface px-3 text-center text-xs transition-colors duration-150 focus-within:ring-2 focus-within:ring-brand/50 ${over ? 'border-brand bg-today' : 'border-line'}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => { void onFiles(e.target.files ?? []); e.target.value = '' }}
        />
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
            <button type="button" className="press shrink-0 text-xs text-sub hover-pointer:underline underline-offset-4"
              onClick={() => setRefused((r) => r.filter((x) => x.key !== f.key))}>ลบออก</button>
          </div>
          <span className="text-xs text-danger">{f.message}</span>
          {f.tooBig && (
            <button type="button" className="press self-start text-xs text-brand-text hover-pointer:underline underline-offset-4"
              onClick={() => { setRefused((r) => r.filter((x) => x.key !== f.key)); inputRef.current?.click() }}>เลือกไฟล์ใหม่</button>
          )}
        </div>
      ))}

      {!clipId && parkedCount(purpose) > 0 && <p className="text-xs text-warn-text">กรอกหัวข้อก่อนแนบไฟล์</p>}

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
  const link = 'press shrink-0 text-xs hover-pointer:underline underline-offset-4'

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
        <div className="flex gap-4">
          {failed ? (
            <>
              <button type="button" className={`${link} text-brand-text`} onClick={onRetry}>อัปต่อจากเดิม</button>
              <button type="button" className={`${link} text-sub`} onClick={onRemove}>ยกเลิกไฟล์นี้</button>
            </>
          ) : (
            <>
              <button type="button" className={`${link} text-brand-text`} onClick={onPause}>{row.paused ? 'อัปต่อ' : 'หยุดชั่วคราว'}</button>
              <button type="button" className={`${link} text-sub`} onClick={onRemove}>ยกเลิก</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
