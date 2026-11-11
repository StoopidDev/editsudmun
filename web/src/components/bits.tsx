import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Play, Upload } from 'lucide-react'
import { useCategories } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { readableOn } from '@/lib/color'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { dayLabel, fromIso, toIso, todayIso, weekDays } from '@/lib/dates'
import { daysLeft, expiresBeforeClip } from '@/lib/media'
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

export function FileTile({ file, clipDate, onDelete }: { file: ClipMedia; clipDate: string; onDelete?: () => void }) {
  const isVideo = file.kind === 'video'
  const early = expiresBeforeClip(file.expires_at, clipDate)
  return (
    <div className={`relative flex h-20 flex-col items-center justify-center gap-1 rounded-card px-2 hover-pointer:brightness-95 ${isVideo ? 'bg-video text-white' : 'bg-surface text-sub'}`}>
      {isVideo ? <Play size={18} /> : <ImageIcon size={18} />}
      <span className="w-full truncate text-center text-xs">{file.file_name}</span>
      <span className={`text-xs ${early ? `font-bold ${isVideo ? 'text-warn-line' : 'text-danger'}` : ''}`}>
        {early ? 'ลบก่อนถึงวันคลิป' : `ลบใน ${daysLeft(file.expires_at)} วัน`}
      </span>
      {onDelete && (
        <button aria-label={`ลบ ${file.file_name}`} onClick={onDelete} className="absolute top-1 right-1 size-5 rounded-full bg-avatar text-xs text-white opacity-70 transition-opacity hover-pointer:hover:opacity-100 before:absolute before:-inset-3 before:content-[''] md:before:hidden">×</button>
      )}
    </div>
  )
}

export function UploadDisabled({ label }: { label: string }) {
  return (
    <div aria-disabled className="flex cursor-not-allowed flex-col items-center gap-1 rounded-card border border-dashed border-line p-4 text-center text-xs text-sub opacity-70">
      <Upload size={16} />
      <span>{label}</span>
      <span>เปิดใช้เมื่อเชื่อมต่อระบบหลังบ้านแล้ว</span>
    </div>
  )
}

export function ConfirmDialog(props: {
  open: boolean; title: string; body: ReactNode; confirm: string
  onConfirm: () => void; onClose: () => void
}) {
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={props.onClose}>ยกเลิก</Button>
          <Button className="bg-danger text-white hover:bg-danger/90" onClick={() => { props.onConfirm(); props.onClose() }}>{props.confirm}</Button>
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
