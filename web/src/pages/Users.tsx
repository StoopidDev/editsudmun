import { useState, type CSSProperties, type FormEvent } from 'react'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { KeyRound, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import * as api from '@/api/index'
import { useAct, useUsers } from '@/api/queries'
import { ConfirmDialog } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Profile } from '@/lib/types'
import { useLast } from '@/lib/useLast'

// User writes change only the user list.
const USER_KEYS = [['users']] as const

export function Users() {
  const { data: users = [] } = useUsers()
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Profile | null>(null)
  const [resetting, setResetting] = useState<Profile | null>(null)
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null)
  const reset = useAct(api.resetPassword, USER_KEYS)
  const remove = useAct(api.deleteUser, USER_KEYS)
  const lastDeleting = useLast(deleting)
  const lastResetting = useLast(resetting)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">ผู้ใช้งาน</h1>
        <Button className="min-h-11 md:min-h-0" onClick={() => setCreating(true)}><Plus />สร้างบัญชีครีเอเตอร์</Button>
      </div>
      <div className="overflow-hidden rounded-card border border-line">
        {users.map((u, i) => (
          <div key={u.id} className="enter grid items-center gap-2 border-t border-grid p-3 first:border-t-0 md:grid-cols-[1fr_1.5fr_100px_120px_auto]" style={{ '--i': i } as CSSProperties}>
            <b className="text-sm">{u.display_name}</b>
            <span className="truncate text-sm text-sub">{u.email}</span>
            <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-bold ${u.role === 'owner' ? 'bg-today text-brand-text' : 'bg-surface text-sub'}`}>{u.role === 'owner' ? 'เจ้าของ' : 'ครีเอเตอร์'}</span>
            <span className="text-sm text-sub">{format(parseISO(u.created_at), 'd MMM yyyy', { locale: th })}</span>
            <span className="flex gap-1">
              <Button variant="ghost" className="min-h-11 md:min-h-0" disabled={u.role === 'owner'} aria-label={`รีเซ็ตรหัสผ่าน ${u.display_name}`} onClick={() => setResetting(u)}><KeyRound />รีเซ็ตรหัสผ่าน</Button>
              <Button variant="ghost" className="min-h-11 text-danger md:min-h-0" disabled={u.role === 'owner'} aria-label={`ลบ ${u.display_name}`} onClick={() => setDeleting(u)}><Trash2 />ลบ</Button>
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-sub">เฉพาะเจ้าของช่องเท่านั้นที่สร้างและจัดการบัญชีผู้ใช้งานได้</p>

      {creating && <CreateDialog onClose={() => setCreating(false)} onDone={(email, password) => { setCreating(false); setTemp({ email, password }) }} />}

      {temp && <TempPassword temp={temp} onClose={() => setTemp(null)} />}

      <ConfirmDialog open={!!resetting} title={`รีเซ็ตรหัสผ่าน ${lastResetting?.display_name}?`} body="รหัสผ่านเดิมจะใช้ไม่ได้ทันที" confirm="รีเซ็ต"
        onConfirm={async () => { if (resetting) setTemp({ email: resetting.email, password: await reset.mutateAsync(resetting.id) }) }} loading={reset.isPending} onClose={() => setResetting(null)} />

      <ConfirmDialog open={!!deleting} title={`ลบบัญชี ${lastDeleting?.display_name}?`} body="ผู้ใช้นี้จะเข้าสู่ระบบไม่ได้อีก" confirm="ลบบัญชี"
        onConfirm={() => deleting && remove.mutateAsync(deleting.id)} loading={remove.isPending} onClose={() => setDeleting(null)} />
    </div>
  )
}

function CreateDialog({ onClose, onDone }: { onClose: () => void; onDone: (email: string, password: string) => void }) {
  const create = useAct(({ name, email }: { name: string; email: string }) => api.createCreator(name, email), USER_KEYS)
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const name = String(f.get('name')).trim()
    if (!name) return
    create.mutate({ name, email: String(f.get('email')) }, {
      onSuccess: (r) => onDone(r.user.email, r.tempPassword),
    })
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>สร้างบัญชีครีเอเตอร์</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-1"><Label htmlFor="name">ชื่อ</Label><Input id="name" name="name" required pattern="\S.*" title="ต้องไม่เป็นช่องว่างล้วน" /></div>
          <div className="grid gap-1"><Label htmlFor="email">อีเมล</Label><Input id="email" name="email" type="email" required /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" loading={create.isPending}>สร้างบัญชี</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TempPassword({ temp, onClose }: { temp: { email: string; password: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => navigator.clipboard.writeText(temp.password)
    .then(() => toast.success('คัดลอกแล้ว'))
    .catch(() => toast.error('คัดลอกไม่สำเร็จ เลือกข้อความแล้วคัดลอกเอง'))
    // A failed copy still unlocks close, so the owner is never trapped here.
    .finally(() => setCopied(true))
  return (
    <Dialog open onOpenChange={(o) => !o && copied && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>รหัสผ่านชั่วคราว</DialogTitle>
          <DialogDescription>รหัสนี้จะไม่แสดงอีก คัดลอกก่อนจึงจะปิดได้</DialogDescription>
        </DialogHeader>
        <p className="text-sm">{temp.email}</p>
        <code className="rounded-card bg-surface p-3 text-lg select-all">{temp.password}</code>
        <DialogFooter>
          <Button variant="outline" onClick={() => void copy()}>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</Button>
          <Button disabled={!copied} onClick={onClose}>ปิด</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
