import { useState, type CSSProperties, type FormEvent } from 'react'
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import * as api from '@/api/index'
import { useAct, useCategories, useCategoryCounts } from '@/api/queries'
import { ConfirmDialog } from '@/components/bits'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { nextColor } from '@/lib/color'
import type { Category } from '@/lib/types'
import { useLast } from '@/lib/useLast'

type Editing = Category | 'new' | null

// A category write changes the category list, its counts, and the clips that carry it.
const CATEGORY_KEYS = [['categories'], ['categoryCounts'], ['clips']] as const

export function Categories() {
  const { data: cats = [], isPending } = useCategories()
  const { data: counts = {} } = useCategoryCounts()
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const remove = useAct(api.deleteCategory, CATEGORY_KEYS)
  const lastDeleting = useLast(deleting)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">ประเภทคลิป</h1>
        <Button className="min-h-11 md:min-h-0" onClick={() => setEditing('new')}><Plus />เพิ่มประเภท</Button>
      </div>
      {!isPending && cats.length === 0 && (
        <div className="overflow-hidden rounded-card border border-line">
          <EmptyState icon={Tags} title="ยังไม่มีประเภทคลิป" hint="กด “เพิ่มประเภท” เพื่อสร้างประเภทแรก" className="py-10" />
        </div>
      )}
      {cats.length > 0 && (
        <>
        <div className="overflow-hidden rounded-card border border-line">
          <div className="hidden grid-cols-[40px_1fr_120px_140px] bg-surface p-3 text-xs text-sub md:grid">
            <span>สี</span><span>ชื่อประเภท</span><span>จำนวนคลิป</span><span className="text-right">การจัดการ</span>
          </div>
          {cats.map((c, i) => (
            <div key={c.id} className="enter grid grid-cols-[32px_1fr_auto] items-center gap-y-1 border-t border-grid p-3 md:grid-cols-[40px_1fr_120px_140px]" style={{ '--i': i } as CSSProperties}>
              <span className="size-3 rounded-full" style={{ background: c.color }} />
              <b className="text-sm">{c.name}</b>
              <span className="text-sm max-md:hidden">{counts[c.id] ?? 0}</span>
              <span className="flex justify-end gap-1">
                <Button variant="outline" size="sm" className="max-md:size-11" aria-label={`แก้ไข ${c.name}`} onClick={() => setEditing(c)}><Pencil /><span className="max-md:hidden">แก้ไข</span></Button>
                <Button variant="outline" size="sm" className="text-danger max-md:size-11" disabled={(counts[c.id] ?? 0) > 0} aria-label={`ลบ ${c.name}`} onClick={() => setDeleting(c)}><Trash2 /><span className="max-md:hidden">ลบ</span></Button>
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-sub">ลบได้เฉพาะประเภทที่ไม่มีคลิป</p>
        </>
      )}
      {editing && <CategoryDialog editing={editing} used={cats.map((c) => c.color)} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!deleting} title={`ลบประเภท “${lastDeleting?.name}”?`} body="ลบแล้วกู้คืนไม่ได้" confirm="ลบ"
        onConfirm={() => deleting && remove.mutateAsync(deleting.id)} loading={remove.isPending} onClose={() => setDeleting(null)} />
    </div>
  )
}

function CategoryDialog({ editing, used, onClose }: { editing: Category | 'new'; used: string[]; onClose: () => void }) {
  const current = editing === 'new' ? null : editing
  const save = useAct(({ name, color }: { name: string; color: string }) =>
    current ? api.updateCategory(current.id, { name, color }) : api.createCategory(name, color).then(() => undefined), CATEGORY_KEYS)

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const name = String(f.get('name')).trim()
    if (!name) return
    save.mutate({ name, color: String(f.get('color')) }, { onSuccess: onClose })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{current ? 'แก้ไขประเภท' : 'เพิ่มประเภท'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-1"><Label htmlFor="name">ชื่อประเภท</Label><Input id="name" name="name" required pattern="\S.*" title="ต้องไม่เป็นช่องว่างล้วน" defaultValue={current?.name} /></div>
          <div className="grid gap-1"><Label htmlFor="color">สี</Label><input id="color" name="color" type="color" defaultValue={current?.color ?? nextColor(used)} className="h-9 w-16" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" loading={save.isPending}>บันทึก</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
