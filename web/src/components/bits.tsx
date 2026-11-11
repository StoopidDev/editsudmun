import { useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
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
    <span className="inline-block rounded-md px-2 py-0.5 text-xs font-bold" style={{ background: cat.color, color: readableOn(cat.color) }}>
      {cat.name}
    </span>
  )
}

export function StatusChip({ status }: { status: ClipStatus }) {
  const s = STATUS[status]
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${s.className}`}>{s.label}</span>
}

export function FileTile({ file, clipDate, url, onOpen, onDelete }: {
  file: ClipMedia; clipDate: string; url?: string
  onOpen?: (el: HTMLElement) => void; onDelete?: () => void
}) {
  const isVideo = file.kind === 'video'
  const early = expiresBeforeClip(file.expires_at, clipDate)
  const [loaded, setLoaded] = useState(false)
  const [seconds, setSeconds] = useState<number | null>(null)
  const dur = seconds === null ? '' : formatDuration(seconds)
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className={`relative aspect-[103/68] overflow-hidden rounded-card ${isVideo ? 'bg-video' : 'bg-surface'}`}>
        {url && !isVideo && (
          <img src={url} alt="" loading="lazy" decoding="async" onLoad={() => setLoaded(true)}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`} />
        )}
        {url && isVideo && isPlayable(file.mime) && (
          // Metadata only: the first frame is the thumbnail and loadedmetadata gives the duration.
          <video src={url} preload="metadata" muted playsInline onLoadedMetadata={(e) => setSeconds(e.currentTarget.duration)}
            className="absolute inset-0 size-full object-cover" />
        )}
        {isVideo && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-white"><span className="flex size-8 items-center justify-center rounded-full bg-black/40"><Play size={14} /></span></span>}
        {(!url || (!isVideo && !loaded)) && <Skeleton className="absolute inset-0 rounded-none" />}
        {onOpen && (
          <button type="button" aria-label={`เปิด ${file.file_name}`} disabled={!url}
            onClick={(e) => onOpen(e.currentTarget)} className="hover-tint absolute inset-0 rounded-card focus-visible:ring-2 focus-visible:ring-brand" />
        )}
        {onDelete && (
          <button aria-label={`ลบ ${file.file_name}`} onClick={onDelete} className="absolute top-1 right-1 z-10 size-5 rounded-full bg-avatar text-xs text-white opacity-70 transition-opacity hover-pointer:opacity-100 before:absolute before:-inset-3 before:content-[''] md:before:hidden">×</button>
        )}
      </div>
      <span className="block truncate text-xs">{file.file_name}{dur && ` · ${dur}`}</span>
      <span className={`text-xs ${early ? `font-bold ${isVideo ? 'text-warn-line' : 'text-danger'}` : 'text-sub'}`}>
        {early ? 'ลบก่อนถึงวันคลิป' : `ลบใน ${daysLeft(file.expires_at)} วัน`}
      </span>
    </div>
  )
}

export function ConfirmDialog(props: {
  open: boolean; title: string; body: ReactNode; confirm: string; loading?: boolean
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
          <Button variant="outline" onClick={props.onClose} disabled={props.loading}>ยกเลิก</Button>
          <Button className="bg-danger text-white hover:bg-danger/90" loading={props.loading}
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
      <Button variant="outline" size="icon" aria-label="สัปดาห์ก่อน" onClick={() => setAnchor(addDays(anchor, -7))}><ChevronLeft /></Button>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {weekDays(anchor).map((d) => {
          const iso = toIso(d)
          const cls = iso === value ? 'bg-brand text-white' : iso === todayIso() ? 'border border-brand bg-today' : 'bg-surface'
          return (
            <button key={iso} onClick={() => onChange(iso)} className={`press rounded-card p-2 text-center text-xs ${cls}`}>
              {dayLabel(d)}<br /><b className="text-base">{d.getDate()}</b>
            </button>
          )
        })}
      </div>
      <Button variant="outline" size="icon" aria-label="สัปดาห์ถัดไป" onClick={() => setAnchor(addDays(anchor, 7))}><ChevronRight /></Button>
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
