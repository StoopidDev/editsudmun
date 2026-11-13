import { useState } from 'react'
import * as api from '@/api/index'
import { useAct } from '@/api/queries'
import { DayStrip } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fromIso, fullDate } from '@/lib/dates'
import type { Clip } from '@/lib/types'
import { toast } from 'sonner'

export function CopyDialog({ clip, onClose }: { clip: Pick<Clip, 'id' | 'title' | 'date'>; onClose: () => void }) {
  const [date, setDate] = useState(clip.date)
  const copy = useAct(() => api.copyClip(clip.id, date))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>คัดลอกไปวันอื่น</DialogTitle>
          <DialogDescription>เลือกวันที่จะวางคลิปนี้ พร้อมสคริปต์ หมายเหตุ และรูปภาพ</DialogDescription>
        </DialogHeader>
        <div className="rounded-card bg-surface p-3 text-sm"><b>{clip.title}</b><br /><span className="text-xs text-sub">จากวัน{fullDate(fromIso(clip.date))}</span></div>
        <DayStrip value={date} onChange={setDate} />
        <p className="text-sm text-brand">วันที่เลือก: {fullDate(fromIso(date))}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button loading={copy.isPending} onClick={() => copy.mutate(undefined, { onSuccess: () => { toast.success('คัดลอกแล้ว'); onClose() } })}>คัดลอก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
