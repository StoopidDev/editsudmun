import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer } from '@base-ui/react/drawer'
import { Clapperboard, Check, Copy, GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import * as api from '@/api/index'
import { useCategories, useClips, useDeleteClip, useMe, useOptimisticAct } from '@/api/queries'
import { CopyDialog } from '@/components/CopyDialog'
import { ClipCard } from '@/components/ClipCard'
import { ConfirmDialog } from '@/components/bits'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { DateLabel } from '@/components/DateLabel'
import { moveInDay } from '@/lib/order'
import { useLast } from '@/lib/useLast'
import { useMediaQuery } from '@/lib/useMediaQuery'
import type { ClipCardRow } from '@/lib/types'

// Phones (below md) get a bottom drawer that swipes away; md and up keep the right-hand sheet.
export function DayDrawer({ date, onClose }: { date: string; onClose: () => void }) {
  const nav = useNavigate()
  const { data: me } = useMe()
  const { data: clips = [] } = useClips(date, date)
  const { data: cats = [] } = useCategories()
  const [filter, setFilter] = useState<string | null>(null)
  const [copying, setCopying] = useState<ClipCardRow | null>(null)
  // Closing runs the exit animation first; the parent unmounts only once it has finished.
  // Mount closed, then open on the next frame so the enter transition always runs.
  const [open, setOpen] = useState(false)
  const wasOpen = useRef(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => { wasOpen.current = true; setOpen(true) })
    return () => cancelAnimationFrame(id)
  }, [])
  const wide = useMediaQuery('(min-width: 768px)')
  // Drag to reorder: the grabbed row follows the pointer, the rows it passes step aside, and the drop is one optimistic write.
  const reorder = useOptimisticAct(({ id, from, to }: { id: string; from: number; to: number }) => api.moveClipBy(id, to - from), ({ id, to }) => ({
    id,
    rows: (rows) => moveInDay(rows, id, to),
  }), { id: 'clips-order' }, true)
  const [deleting, setDeleting] = useState<ClipCardRow | null>(null)
  const lastDeleting = useLast(deleting)
  const list = useRef<HTMLDivElement>(null)
  const grab = useRef({ y: 0, mids: [] as number[] })
  const [held, setDrag] = useState<{ id: string; from: number; to: number; dy: number; step: number; droppedAt?: string } | null>(null)
  const order = clips.map((c) => c.id).join()
  // After a drop the rows keep their dragged offsets until the new order is on screen (the order differs from the one at the drop), so nothing jumps back for a frame.
  const drag = held && (held.droppedAt === undefined || held.droppedAt === order) ? held : null
  const onGrab = (e: PointerEvent<HTMLButtonElement>, id: string, from: number) => {
    e.preventDefault()
    e.stopPropagation() // the phone drawer must not read this as a swipe to close
    e.currentTarget.setPointerCapture(e.pointerId)
    const rects = [...(list.current?.querySelectorAll('[data-row]') ?? [])].map((el) => el.getBoundingClientRect())
    grab.current = { y: e.clientY, mids: rects.map((r) => r.top + r.height / 2) }
    setDrag({ id, from, to: from, dy: 0, step: rects[from].height + 8 })
  }
  const onDrag = (e: PointerEvent) => {
    if (!drag || drag.droppedAt !== undefined) return
    const dy = e.clientY - grab.current.y
    const mid = grab.current.mids[drag.from] + dy
    setDrag({ ...drag, dy, to: grab.current.mids.filter((m, i) => i !== drag.from && m < mid).length })
  }
  const onDrop = () => {
    if (!drag || drag.droppedAt !== undefined) return
    if (drag.to === drag.from) return setDrag(null)
    setDrag({ ...drag, droppedAt: order })
    reorder.mutate(drag, { onError: () => setDrag(null) })
  }
  // How far a row is moved while a drag is on: the grabbed row by the pointer, the rows it has passed by one slot.
  const shift = (id: string, i: number) => {
    if (!drag) return undefined
    if (id === drag.id) return drag.dy
    if (i > drag.from && i <= drag.to) return -drag.step
    if (i < drag.from && i >= drag.to) return drag.step
    return 0
  }
  const del = useDeleteClip()
  const owner = me?.role === 'owner'
  const shown = filter ? clips.filter((c) => c.category_id === filter) : clips
  const Title = wide ? SheetTitle : Drawer.Title
  const Desc = wide ? SheetDescription : Drawer.Description
  const exit = { onOpenChange: (o: boolean) => !o && setOpen(false), onOpenChangeComplete: (o: boolean) => !o && wasOpen.current && onClose() }

  const chip = (id: string | null, label: string, n: number) => (
    <button key={id ?? 'all'} onClick={() => setFilter(id)} aria-pressed={filter === id} className={`press hover-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs ${filter === id ? 'bg-brand text-white' : ''}`}>
      {filter === id && <Check size={12} aria-hidden />}
      <span>{label} {n}</span>
    </button>
  )

  const body = (
    <>
      <Title className="text-base"><DateLabel date={date} className="text-base" /></Title>
      <Desc className="text-sm text-sub">{clips.length} คลิป</Desc>
      <div className="flex flex-wrap gap-2">
        {chip(null, 'ทั้งหมด', clips.length)}
        {cats.map((c) => chip(c.id, c.name, clips.filter((x) => x.category_id === c.id).length))}
      </div>
      <div ref={list} className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {shown.map((c, i) => (
          <div key={c.id} data-row className={`flex items-start gap-1 ${drag?.id === c.id ? 'relative z-10 opacity-90 drop-shadow-lg' : drag ? 'transition-transform duration-200' : ''}`}
            style={{ viewTransitionName: `clip-${c.id}`, transform: drag ? `translateY(${shift(c.id, i)}px)` : undefined }}>
            <div className="min-w-0 flex-1"><ClipCard clip={c} /></div>
            {owner && (
              <div className="flex flex-col">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`เมนู ${c.title}`} />}>
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => nav(`/clips/${c.id}`, { viewTransition: true })}><Pencil />แก้ไข</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCopying(c)}><Copy />คัดลอก</DropdownMenuItem>
                  <DropdownMenuItem className="text-danger" onClick={() => setDeleting(c)}><Trash2 />ลบ</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {filter === null && clips.length > 1 && (
                <Button variant="ghost" size="icon" aria-label={`จัดลำดับ ${c.title}: ลาก หรือกดลูกศรขึ้นลง`} className={`touch-none ${drag?.id === c.id ? 'cursor-grabbing' : 'cursor-grab'}`}
                  onPointerDown={(e) => onGrab(e, c.id, i)} onPointerMove={onDrag} onPointerUp={onDrop} onPointerCancel={() => setDrag(null)}
                  onTouchStart={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1
                    if (to < 0 || to >= clips.length) return
                    e.preventDefault()
                    reorder.mutate({ id: c.id, from: i, to })
                  }}><GripVertical /></Button>
              )}
              </div>
            )}
          </div>
        ))}
        {shown.length === 0 && (
          <EmptyState icon={Clapperboard} title="ยังไม่มีคลิปในวันนี้"
            hint={filter ? 'ลองเลือกประเภทอื่น หรือกด “ทั้งหมด”' : owner ? 'กด “เพิ่มคลิป” เพื่อเริ่มวางแผนวันนี้' : 'เจ้าของยังไม่ได้ใส่งานของวันนี้'} />
        )}
      </div>
      {owner && <Button onClick={() => nav(`/clips/new?date=${date}`, { viewTransition: true })}><Plus />เพิ่มคลิป</Button>}
      {copying && <CopyDialog clip={copying} onClose={() => setCopying(null)} />}
      <ConfirmDialog open={!!deleting} title={`ลบคลิป “${lastDeleting?.title}”?`} body="หลังลบ กด “เลิกทำ” ได้ทันทีถ้าลบผิด" confirm="ลบคลิป"
        onConfirm={() => deleting && del(deleting.id)} onClose={() => setDeleting(null)} />
    </>
  )

  if (wide) {
    return (
      <Sheet open={open} {...exit}>
        <SheetContent className="flex w-full flex-col gap-3 p-4 sm:max-w-105 data-[side=right]:w-full data-[side=right]:sm:max-w-105">
          {body}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Drawer.Root open={open} {...exit}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/10 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Drawer.Viewport className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center">
          <Drawer.Popup className="pointer-events-auto flex h-[85dvh] w-full flex-col gap-3 rounded-t-[16px] bg-popover p-4 pt-2 text-sm text-popover-foreground shadow-lg outline-none translate-y-(--drawer-swipe-movement-y) transition-transform duration-360 ease-(--ease-drawer) data-ending-style:translate-y-full data-starting-style:translate-y-full data-ending-style:duration-200 data-ending-style:ease-(--ease-in-quint) data-swiping:transition-none">
            <div aria-hidden className="mx-auto h-1 w-9 shrink-0 rounded-full bg-line" />
            {body}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
