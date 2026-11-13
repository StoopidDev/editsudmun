import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ImageIcon, Play } from 'lucide-react'
import { useCategories } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { readableOn } from '@/lib/color'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { dayLabel, fromIso, toIso, todayIso, weekDays } from '@/lib/dates'
import { daysLeft, expiresBeforeClip, formatDuration, isPlayable } from '@/lib/media'
import { STATUS } from '@/lib/status'
import type { ClipMedia, ClipStatus } from '@/lib/types'
import { addDays } from 'date-fns'

export function CategoryBadge({ categoryId }: { categoryId: string }) {
  const { data } = useCategories()
  const cat = data?.find((c) => c.id === categoryId)
  if (!cat) return null
  return (
    <span className="inline-block rounded-md px-2 py-0.5 text-xs font-bold transition-colors duration-200" style={{ background: cat.color, color: readableOn(cat.color) }}>
      {cat.name}
    </span>
  )
}

// transitionName lets a page morph this chip on change; drawCheck adds the approve tick that draws in.
export function StatusChip({ status, transitionName, drawCheck }: { status: ClipStatus; transitionName?: string; drawCheck?: boolean }) {
  const s = STATUS[status]
  // The tick draws once, when this chip sees the change to approved; a chip that mounts approved stays still.
  const prev = useRef(status)
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    if (status === 'approved' && prev.current !== 'approved') setDrawn(true)
    prev.current = status
  }, [status])
  return (
    <span style={transitionName ? { viewTransitionName: transitionName } : undefined}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold transition-colors duration-200 ${s.className}`}>
      {s.label}
      {drawCheck && drawn && status === 'approved' && (
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" pathLength={1} className="check-draw" />
        </svg>
      )}
    </span>
  )
}

export function FileTile({ file, clipDate, url, onOpen, onDelete }: {
  file: ClipMedia; clipDate: string; url?: string
  onOpen?: (el: HTMLElement) => void; onDelete?: () => void
}) {
  const isVideo = file.kind === 'video'
  const early = expiresBeforeClip(file.expires_at, clipDate)
  const [loaded, setLoaded] = useState(false)
  // A video's metadata (first frame, duration) is fetched only once its tile is near the screen.
  const tile = useRef<HTMLDivElement>(null)
  // Without IntersectionObserver (old browsers, tests) the metadata loads at once.
  const [near, setNear] = useState(() => !('IntersectionObserver' in window))
  useEffect(() => {
    const el = tile.current
    if (!el || !isVideo || near) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); io.disconnect() }
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [isVideo, near])
  // Remember which URL failed (e.g. HEIC in Chrome, or an expired link): a fresh URL gets a new try.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)
  const broken = !!url && brokenUrl === url
  const [seconds, setSeconds] = useState<number | null>(null)
  const dur = seconds === null ? '' : formatDuration(seconds)
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div ref={tile} className={`relative aspect-103/68 overflow-hidden rounded-card ${isVideo ? 'bg-video' : 'bg-surface'}`}>
        {url && !isVideo && !broken && (
          <img src={url} alt="" width={103} height={68} loading="lazy" fetchPriority="low" decoding="async" onLoad={() => setLoaded(true)} onError={() => setBrokenUrl(url)}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`} />
        )}
        {broken && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center text-xs text-sub">
            <ImageIcon size={20} aria-hidden />
            <span className="line-clamp-2 break-all">{file.file_name}</span>
          </span>
        )}
        {url && isVideo && isPlayable(file.mime) && (
          // Metadata only: the first frame is the thumbnail and loadedmetadata gives the duration.
          <video src={url} preload={near ? 'metadata' : 'none'} muted playsInline onLoadedMetadata={(e) => setSeconds(e.currentTarget.duration)}
            className="absolute inset-0 size-full object-cover" />
        )}
        {isVideo && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-white"><span className="flex size-8 items-center justify-center rounded-full bg-black/40"><Play size={14} /></span></span>}
        {(!url || (!isVideo && !loaded && !broken)) && <Skeleton className="absolute inset-0 rounded-none" />}
        {onOpen && (
          <button type="button" aria-label={`เปิด ${file.file_name}`} disabled={!url}
            onClick={(e) => onOpen(e.currentTarget)} className="press hover-tint absolute inset-0 rounded-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />
        )}
        {onDelete && (
          <button aria-label={`ลบ ${file.file_name}`} onClick={onDelete} className="absolute top-1 right-1 z-10 size-5 rounded-full bg-avatar text-xs text-white opacity-70 transition-opacity hover-pointer:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand before:absolute before:-inset-3 before:content-[''] md:before:hidden">×</button>
        )}
      </div>
      <span className="block truncate text-xs tabular-nums">{file.file_name}{dur && ` · ${dur}`}</span>
      <span className={`text-xs tabular-nums ${early ? `font-bold ${isVideo ? 'text-warn-line' : 'text-danger'}` : 'text-sub'}`}>
        {early ? 'ลบก่อนถึงวันคลิป' : `ลบใน ${daysLeft(file.expires_at)} วัน`}
      </span>
    </div>
  )
}

// The sixth tile of a reference grid when there are more files: opens the lightbox on the first hidden one.
export function MoreTile({ count, onOpen }: { count: number; onOpen: (el: HTMLElement) => void }) {
  return (
    <button type="button" aria-label={`ดูไฟล์อีก ${count} ไฟล์`} onClick={(e) => onOpen(e.currentTarget)}
      className="press hover-tint flex aspect-103/68 items-center justify-center rounded-card bg-surface text-sm font-bold text-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
      <span className="tabular-nums">+{count}</span>
    </button>
  )
}

export function ConfirmDialog(props: {
  open: boolean; title: string; body: ReactNode; confirm: string; loading?: boolean
  tone?: 'danger' | 'neutral' // danger (default) is red and for deletes; neutral is the brand button for reversible actions such as logging out
  onConfirm: () => unknown; onClose: () => void
}) {
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="max-md:min-h-11" onClick={props.onClose} disabled={props.loading}>ยกเลิก</Button>
          <Button className={props.tone === 'neutral' ? 'max-md:min-h-11' : 'bg-danger-fill text-white hover-pointer:bg-danger-fill/90 max-md:min-h-11'} loading={props.loading}
            onClick={async () => {
              try { await props.onConfirm(); props.onClose() } catch { /* useAct shows the toast; keep the dialog open */ }
            }}>{props.confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DayStrip({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [anchor, setAnchor] = useState(() => fromIso(value))
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="max-md:min-h-11 max-md:min-w-11" aria-label="สัปดาห์ก่อน" onClick={() => setAnchor(addDays(anchor, -7))}><ChevronLeft /></Button>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {weekDays(anchor).map((d) => {
          const iso = toIso(d)
          const cls = iso === value ? 'bg-brand text-white' : iso === todayIso() ? 'border border-brand bg-today cell-hover' : 'bg-surface cell-hover'
          return (
            <button key={iso} onClick={() => onChange(iso)} className={`press rounded-card p-2 text-center text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${cls}`}>
              {dayLabel(d)}<br /><b className="text-base tabular-nums">{d.getDate()}</b>
            </button>
          )
        })}
      </div>
      <Button variant="outline" size="icon" className="max-md:min-h-11 max-md:min-w-11" aria-label="สัปดาห์ถัดไป" onClick={() => setAnchor(addDays(anchor, 7))}><ChevronRight /></Button>
    </div>
  )
}

export const Skeleton = ({ className = '' }: { className?: string }) => <div aria-hidden className={`skeleton ${className}`} />

// Renders children only after 150 ms, so fast loads never flash a skeleton. Announced as a loading status.
export function Delayed({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 150)
    return () => clearTimeout(t)
  }, [])
  return show ? <div role="status"><span className="sr-only">กำลังโหลด</span>{children}</div> : null
}
