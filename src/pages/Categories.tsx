import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import * as api from '@/api/index'
import { useAct, useCategories, useCategoryCounts } from '@/api/queries'
import { ConfirmDialog } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Category } from '@/lib/types'
import { useLast } from '@/lib/useLast'

type Editing = Category | 'new' | null

export function Categories() {
  const { data: cats = [], isPending } = useCategories()
  const { data: counts = {} } = useCategoryCounts()
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const remove = useAct(api.deleteCategory)
  const lastDeleting = useLast(deleting)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">ประเภทคลิป</h1>
        <Button onClick={() => setEditing('new')}><Plus />เพิ่มประเภท</Button>
      </div>
      {!isPending && cats.length === 0 && <p className="py-16 text-center text-sub">ยังไม่มีประเภทคลิป</p>}
      {cats.length > 0 && (
        <div className="overflow-hidden rounded-card border border-line">
          <div className="hidden grid-cols-[40px_1fr_120px_140px] bg-surface p-3 text-xs text-sub md:grid">
            <span>สี</span><span>ชื่อประเภท</span><span>จำนวนคลิป</span><span className="text-right">การจัดการ</span>
          </div>
          {cats.map((c) => (
            <div key={c.id} className="grid grid-cols-[32px_1fr_auto] items-center gap-y-1 border-t border-grid p-3 md:grid-cols-[40px_1fr_120px_140px]">
              <span className="size-3 rounded-full" style={{ background: c.color }} />
              <b className="text-sm">{c.name}</b>
              <span className="text-sm max-md:hidden">{counts[c.id] ?? 0}</span>
              <span className="flex justify-end gap-1">
                <Button variant="ghost" className="size-11 md:size-auto" aria-label={`แก้ไข ${c.name}`} onClick={() => setEditing(c)}><Pencil /><span className="max-md:hidden">แก้ไข</span></Button>
                <Button variant="ghost" className="size-11 text-danger md:size-auto" aria-label={`ลบ ${c.name}`} onClick={() => setDeleting(c)}><Trash2 /><span className="max-md:hidden">ลบ</span></Button>
              </span>
            </div>
          ))}
        </div>
      )}
      {editing && <CategoryDialog editing={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!deleting} title={`ลบประเภท “${lastDeleting?.name}”?`} body="ลบได้เฉพาะประเภทที่ไม่มีคลิปอยู่" confirm="ลบ"
        onConfirm={() => deleting && remove.mutate(deleting.id)} onClose={() => setDeleting(null)} />
    </div>
  )
}

function CategoryDialog({ editing, onClose }: { editing: Category | 'new'; onClose: () => void }) {
  const current = editing === 'new' ? null : editing
  const save = useAct(({ name, color }: { name: string; color: string }) =>
    current ? api.updateCategory(current.id, { name, color }) : api.createCategory(name, color).then(() => undefined))

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
          <div className="grid gap-1"><Label htmlFor="color">สี</Label><input id="color" name="color" type="color" defaultValue={current?.color ?? '#6155f5'} className="h-9 w-16" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={save.isPending}>บันทึก</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
