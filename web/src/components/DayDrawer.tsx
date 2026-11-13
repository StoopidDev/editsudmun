import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer } from '@base-ui/react/drawer'
import { ArrowDown, ArrowUp, Clapperboard, Check, Copy, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import * as api from '@/api/index'
import { useCategories, useClips, useDeleteClip, useMe, useOptimisticAct } from '@/api/queries'
import { CopyDialog } from '@/components/CopyDialog'
import { ClipCard } from '@/components/ClipCard'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { DateLabel } from '@/components/DateLabel'
import { swapInDay } from '@/lib/order'
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
  const move = useOptimisticAct(({ id, dir }: { id: string; dir: -1 | 1 }) => api.moveClip(id, dir), ({ id, dir }) => ({
    id,
    rows: (rows) => swapInDay(rows, id, dir),
  }), { id: 'clips-order' })
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
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {shown.map((c) => (
          <div key={c.id} className="flex items-start gap-1" style={{ viewTransitionName: `clip-${c.id}` }}>
            <div className="flex-1"><ClipCard clip={c} /></div>
            {owner && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`เมนู ${c.title}`} />}>
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => nav(`/clips/${c.id}`, { viewTransition: true })}><Pencil />แก้ไข</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCopying(c)}><Copy />คัดลอก</DropdownMenuItem>
                  {filter === null && (
                    <>
                      <DropdownMenuItem onClick={() => move.mutate({ id: c.id, dir: -1 })}><ArrowUp />ย้ายขึ้น</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => move.mutate({ id: c.id, dir: 1 })}><ArrowDown />ย้ายลง</DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem className="text-danger" onClick={() => void del(c.id)}><Trash2 />ลบ</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
