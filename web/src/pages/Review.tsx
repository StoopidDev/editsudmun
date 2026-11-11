import { useState } from 'react'
import { Play } from 'lucide-react'
import { toast } from 'sonner'
import * as api from '@/api/index'
import { useAct, useClip, useMedia } from '@/api/queries'
import { ConfirmDialog, StatusChip } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { daysLeft, formatSize, isPlayable, withRounds } from '@/lib/media'
import type { ClipMedia, ClipStatus } from '@/lib/types'
import { useLast } from '@/lib/useLast'

export function Review({ clipId }: { clipId: string }) {
  const { data: clip } = useClip(clipId)
  const { data: media = [] } = useMedia(clipId)
  const rounds = withRounds(media.filter((m) => m.purpose === 'submission'))
  const [selected, setSelected] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [asking, setAsking] = useState(false)
  const [deleting, setDeleting] = useState<ClipMedia | null>(null)
  const lastDeleting = useLast(deleting)
  const remove = useAct(api.deleteMedia)
  const review = useAct(({ status, note }: { status: 'approved' | 'revision'; note?: string }) => api.reviewClip(clipId, status, note))
  const undo = useAct(({ status, note }: { status: ClipStatus; note: string }) => api.restoreReview(clipId, status, note))
  const current = rounds.find((m) => m.id === selected) ?? rounds[0]

  if (!clip) return null

  const approve = () => {
    const before = { status: clip.status, note: clip.revision_note }
    review.mutate({ status: 'approved' }, {
      onSuccess: () => toast('อนุมัติแล้ว', { duration: 10_000, action: { label: 'เลิกทำ', onClick: () => undo.mutate(before) } }),
    })
  }

  const requestChanges = () => review.mutate({ status: 'revision', note: reason }, {
    onSuccess: () => {
      toast.success('ส่งคำขอแก้ไขแล้ว')
      setReason('')
      setAsking(false)
    },
  })

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line p-3">
      <h2 className="flex justify-between text-sm font-bold">งานที่ครีเอเตอร์ส่ง ({rounds.length} ไฟล์)</h2>
      {rounds.length === 0 ? <p className="text-sm text-sub">ยังไม่มีไฟล์ส่งงาน</p> : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
          <div className="flex aspect-video flex-col justify-between rounded-card bg-video p-3 text-sm text-white">
            <b>รอบ {current.round} · {current.file_name}</b>
            <span className="flex flex-col items-center gap-1"><Play />วิดีโอจริงจะเล่นได้หลังเชื่อมต่อ R2</span>
            <span />
          </div>
          <div className="flex flex-col gap-2">
            {rounds.map((m) => (
              <div key={m.id} className={`flex min-w-0 items-center gap-2 rounded-card border p-2 text-sm ${m.id === current.id ? 'border-brand bg-today' : 'border-grid'}`}>
                <span className="rounded bg-bg px-1 text-xs font-bold">รอบ {m.round}</span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{m.file_name}</b>
                  <span className={`text-xs ${isPlayable(m.mime) ? 'text-sub' : 'text-danger'}`}>
                    {isPlayable(m.mime) ? `${formatSize(m.size_bytes)} · ลบใน ${daysLeft(m.expires_at)} วัน` : 'ProRes · เล่นในเบราว์เซอร์ไม่ได้ ดาวน์โหลดแทน'}
                  </span>
                </div>
                {isPlayable(m.mime)
                  ? <button aria-label={`เล่น ${m.file_name}`} className="min-h-11 md:min-h-0 px-2 text-xs text-brand" onClick={() => setSelected(m.id)}>{m.id === current.id ? 'กำลังเล่น' : 'เล่น'}</button>
                  : <button aria-label={`ดาวน์โหลด ${m.file_name}`} disabled className="min-h-11 md:min-h-0 px-2 text-xs text-sub">ดาวน์โหลด</button>}
                <button aria-label={`ลบ ${m.file_name}`} className="min-h-11 md:min-h-0 px-2 text-xs text-danger" onClick={() => setDeleting(m)}>ลบ</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {asking ? (
        <div className="flex flex-col gap-2">
          <Textarea autoFocus rows={3} aria-label="เหตุผลที่ขอแก้ไข" placeholder="เหตุผลที่ขอแก้ไข (ครีเอเตอร์จะเห็นข้อความนี้)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <span className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAsking(false)}>ยกเลิก</Button>
            <Button loading={review.isPending} disabled={!reason.trim()} onClick={requestChanges}>ส่งคำขอแก้ไข</Button>
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs">สถานะ: <StatusChip status={clip.status} /></span>
          <span className="flex gap-2">
            <Button variant="outline" className="border-warn-line text-warn-text" disabled={rounds.length === 0} onClick={() => setAsking(true)}>ขอแก้ไข</Button>
            <Button className="bg-success text-white hover:bg-success/90" loading={review.isPending} disabled={rounds.length === 0 || clip.status === 'approved'} onClick={approve}>อนุมัติ</Button>
          </span>
        </div>
      )}
      <ConfirmDialog open={!!deleting} title={`ลบไฟล์ “${lastDeleting?.file_name}”?`} body="ไฟล์ที่ครีเอเตอร์ส่งเป็นหลักฐาน ลบแล้วกู้คืนไม่ได้" confirm="ลบ"
        onConfirm={() => deleting && remove.mutateAsync(deleting.id)} loading={remove.isPending} onClose={() => setDeleting(null)} />
    </section>
  )
}
