import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import * as api from '@/api/index'
import { useAct, useCategories, useClips, useDeleteClip, useMe } from '@/api/queries'
import { CopyDialog } from '@/components/CopyDialog'
import { ClipCard } from '@/components/ClipCard'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { fromIso, fullDate } from '@/lib/dates'
import type { ClipCardRow } from '@/lib/types'

export function DayDrawer({ date, onClose }: { date: string; onClose: () => void }) {
  const nav = useNavigate()
  const { data: me } = useMe()
  const { data: clips = [] } = useClips(date, date)
  const { data: cats = [] } = useCategories()
  const [filter, setFilter] = useState<string | null>(null)
  const [copying, setCopying] = useState<ClipCardRow | null>(null)
  const move = useAct(({ id, dir }: { id: string; dir: -1 | 1 }) => api.moveClip(id, dir))
  const del = useDeleteClip()
  const owner = me?.role === 'owner'
  const shown = filter ? clips.filter((c) => c.category_id === filter) : clips

  const chip = (id: string | null, label: string, n: number) => (
    <button key={id ?? 'all'} onClick={() => setFilter(id)} aria-pressed={filter === id} className={`press hover-tint rounded-full border border-line px-3 py-1 text-xs ${filter === id ? 'bg-brand text-white' : ''}`}>
      {label} {n}
    </button>
  )

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-3 p-4 sm:max-w-[420px] data-[side=right]:w-full data-[side=right]:sm:max-w-[420px]">
        <SheetTitle>{fullDate(fromIso(date))}</SheetTitle>
        <SheetDescription>{clips.length} คลิป</SheetDescription>
        <div className="flex flex-wrap gap-2">
          {chip(null, 'ทั้งหมด', clips.length)}
          {cats.map((c) => chip(c.id, c.name, clips.filter((x) => x.category_id === c.id).length))}
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {shown.map((c) => (
            <div key={c.id} className="flex items-start gap-1">
              <div className="flex-1"><ClipCard clip={c} /></div>
              {owner && (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`เมนู ${c.title}`} />}>
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => nav(`/clips/${c.id}`)}><Pencil />แก้ไข</DropdownMenuItem>
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
          {shown.length === 0 && <p className="text-sm text-sub">ไม่มีคลิป</p>}
        </div>
        {owner && <Button onClick={() => nav(`/clips/new?date=${date}`)}><Plus />เพิ่มคลิป</Button>}
        {copying && <CopyDialog clip={copying} onClose={() => setCopying(null)} />}
      </SheetContent>
    </Sheet>
  )
}
