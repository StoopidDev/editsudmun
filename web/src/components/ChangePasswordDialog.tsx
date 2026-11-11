import type { FormEvent } from 'react'
import { toast } from 'sonner'
import * as api from '@/api/index'
import { useAct } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const change = useAct(({ current, next }: { current: string; next: string }) => api.changePassword(current, next))
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    change.mutate({ current: String(f.get('current')), next: String(f.get('next')) }, {
      onSuccess: () => { toast.success('เปลี่ยนรหัสผ่านแล้ว'); onClose() },
    })
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>เปลี่ยนรหัสผ่าน</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-1"><Label htmlFor="current">รหัสผ่านปัจจุบัน</Label><Input id="current" name="current" type="password" required autoComplete="current-password" /></div>
          <div className="grid gap-1"><Label htmlFor="next">รหัสผ่านใหม่ (อย่างน้อย 12 ตัว มีตัวพิมพ์เล็ก ใหญ่ และตัวเลข)</Label><Input id="next" name="next" type="password" required minLength={12} autoComplete="new-password" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={change.isPending}>บันทึก</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
