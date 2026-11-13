import { useEffect, useRef, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { isPlayable } from '@/lib/media'
import { downloadOne, type Viewable } from '@/lib/viewer'

export type Opened = { items: Viewable[]; index: number; from: DOMRect; back: HTMLElement }

export function Lightbox({ opened, open, onOpenChange, onIndex }: {
  opened: Opened; open: boolean; onOpenChange: (o: boolean) => void; onIndex: (i: number) => void
}) {
  const { items, index, from, back } = opened
  const item = items[index]
  const last = items.length - 1
  const go = (d: number) => onIndex(Math.min(last, Math.max(0, index + d)))
  const videoRef = useRef<HTMLVideoElement>(null)
  // Closing (even mid-animation) must stop sound from the open video.
  useEffect(() => { if (!open) videoRef.current?.pause() }, [open])
  if (!item) return null

  // The popup is full screen, so scale and move it from the tile's centre until it fills the viewport.
  const vw = window.innerWidth
  const vh = window.innerHeight
  const style = {
    '--lb-x': `${from.left + from.width / 2 - vw / 2}px`,
    '--lb-y': `${from.top + from.height / 2 - vh / 2}px`,
    '--lb-s': `${from.width / vw}`,
  } as CSSProperties

  const content = item.kind === 'image' ? (
    <img src={item.url} alt={item.file_name} className="max-h-full max-w-full object-contain" />
  ) : isPlayable(item.mime) ? (
    <video key={item.id} ref={videoRef} src={item.url} controls playsInline autoPlay className="max-h-full max-w-full" />
  ) : (
    <div className="flex flex-col items-center gap-3 p-6 text-center text-sm">
      <p>ProRes · เล่นในเบราว์เซอร์ไม่ได้ ดาวน์โหลดแทน</p>
      <Button variant="outline" onClick={() => downloadOne(item.id).catch((e: Error) => toast.error(e.message))}><Download />ดาวน์โหลด</Button>
    </div>
  )

  const arrow = 'press absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover-pointer:bg-black/60'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Popup
          data-slot="lightbox"
          style={style}
          finalFocus={() => back}
          onKeyDown={(e) => {
            // Arrows seek inside a focused video.
            if (e.target instanceof Element && e.target.closest('video')) return
            if (e.key === 'ArrowLeft') go(-1)
            if (e.key === 'ArrowRight') go(1)
          }}
          className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white outline-none"
        >
          <DialogTitle className="sr-only">{item.file_name}</DialogTitle>
          <div className="flex items-center justify-between gap-3 p-3 text-sm">
            <span className="tabular-nums">{index + 1} / {items.length}</span>
            <span className="min-w-0 truncate">{item.file_name}</span>
            <DialogPrimitive.Close aria-label="ปิด" className="press flex size-11 shrink-0 items-center justify-center rounded-full hover-pointer:bg-white/10">
              <X />
            </DialogPrimitive.Close>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-4">
            {index > 0 && <button type="button" aria-label="ก่อนหน้า" className={`${arrow} left-2`} onClick={() => go(-1)}><ChevronLeft /></button>}
            {content}
            {index < last && <button type="button" aria-label="ถัดไป" className={`${arrow} right-2`} onClick={() => go(1)}><ChevronRight /></button>}
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
