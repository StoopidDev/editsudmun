import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import * as api from '@/api/index'
import { useAct, useClip, useMedia, useOptimisticAct } from '@/api/queries'
import { ConfirmDialog, Skeleton, StatusChip } from '@/components/bits'
import { DownloadAll } from '@/components/media'
import { downloadOne } from '@/lib/viewer'
import { sentAt } from '@/lib/dates'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { daysLeft, formatSize, isPlayable, readyIds, withRounds } from '@/lib/media'
import type { ClipMedia, ClipStatus } from '@/lib/types'
import { useLast } from '@/lib/useLast'

export function Review({ clipId, urls }: { clipId: string; urls: Record<string, string> }) {
  const { data: clip } = useClip(clipId)
  const { data: media = [] } = useMedia(clipId)
  const rounds = withRounds(media.filter((m) => m.purpose === 'submission'))
  const [selected, setSelected] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [asking, setAsking] = useState(false)
  const [deleting, setDeleting] = useState<ClipMedia | null>(null)
  const lastDeleting = useLast(deleting)
  const remove = useAct(api.deleteMedia)
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const askRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  useEffect(() => {
    if (asking) reasonRef.current?.focus({ preventScroll: true })
    else if (restoreFocus.current) {
      restoreFocus.current = false
      askRef.current?.focus({ preventScroll: true })
    }
  }, [asking])
  // Approve and request-changes show on the chip, button and list at once; undo replays the same change.
  const review = useOptimisticAct(
    ({ status, note = '' }: { status: 'approved' | 'revision'; note?: string }) => api.reviewClip(clipId, status, note),
    ({ status, note = '' }) => ({ id: clipId, set: { status, revision_note: status === 'revision' ? note.trim() : '' } }),
  )
  const undo = useOptimisticAct(
    ({ status, note }: { status: ClipStatus; note: string }) => api.restoreReview(clipId, status, note),
    ({ status, note }) => ({ id: clipId, set: { status, revision_note: note } }),
  )
  const current = rounds.find((m) => m.id === selected) ?? rounds[0]
  const curUrl = current ? urls[current.id] : undefined
  const totalBytes = rounds.reduce((sum, m) => sum + m.size_bytes, 0)

  if (!clip) return null

  const approve = () => {
    const before = { status: clip.status, note: clip.revision_note }
    review.mutate({ status: 'approved' }, {
      onSuccess: () => toast('อนุมัติแล้ว', { duration: 10_000, action: { label: 'เลิกทำ', onClick: () => undo.mutate(before) } }),
    })
  }

  // The box collapses on press; a failed request reopens it with the reason still typed.
  const requestChanges = () => {
    setAsking(false)
    review.mutate({ status: 'revision', note: reason }, {
      onSuccess: () => {
        toast.success('ส่งคำขอแก้ไขแล้ว')
        setReason('')
      },
      onError: () => setAsking(true),
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line p-3">
      <h2 className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-bold">
        งานที่ครีเอเตอร์ส่ง ({rounds.length} ไฟล์)
        {rounds.length > 0 && <span className="text-xs font-light text-sub">ใช้พื้นที่ {formatSize(totalBytes)} · ลบอัตโนมัติหลัง 30 วัน</span>}
      </h2>
      {rounds.length === 0 ? <p className="text-sm text-sub">ยังไม่มีไฟล์ส่งงาน</p> : (
        <>
          <div className="self-start"><DownloadAll ids={readyIds(rounds)} /></div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-card bg-video text-sm text-white">
              {!curUrl ? (
                <Skeleton className="absolute inset-0 rounded-none" />
              ) : isPlayable(current.mime) ? (
                <video key={current.id} src={curUrl} controls preload="metadata" className="size-full bg-video" />
              ) : (
                <div className="flex flex-col items-center gap-3 p-4 text-center">
                  <p>ProRes · เล่นในเบราว์เซอร์ไม่ได้ ดาวน์โหลดแทน</p>
                  <Button variant="outline" onClick={() => downloadOne(current.id).catch((e: Error) => toast.error(e.message))}>ดาวน์โหลด</Button>
                </div>
              )}
              {curUrl && <b className="pointer-events-none absolute top-3 left-3 rounded bg-black/50 px-2 py-1 text-xs">รอบ {current.round} · {current.file_name}</b>}
            </div>
            <div className="flex flex-col gap-2">
              {rounds.map((m) => (
                <div key={m.id} className={`flex min-w-0 items-center gap-2 rounded-card border p-2 text-sm ${m.id === current.id ? 'border-brand bg-today' : 'border-grid'}`}>
                  <span className="shrink-0 rounded bg-bg px-1 text-xs font-bold">รอบ {m.round}</span>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate">{m.file_name}</b>
                    <span className={`text-xs ${isPlayable(m.mime) ? 'text-sub' : 'text-danger'}`}>
                      {isPlayable(m.mime) ? '' : 'ProRes · '}{formatSize(m.size_bytes)} · {sentAt(m.created_at)} · ลบใน {daysLeft(m.expires_at)} วัน
                    </span>
                  </div>
                  {isPlayable(m.mime)
                    ? <button aria-label={`เล่น ${m.file_name}`} disabled={!urls[m.id]} className="press min-h-11 px-2 text-xs text-brand disabled:text-sub md:min-h-0" onClick={() => setSelected(m.id)}>{m.id === current.id ? 'กำลังเล่น' : 'เล่น'}</button>
                    : <button aria-label={`ดาวน์โหลด ${m.file_name}`} disabled={!urls[m.id]} className="press min-h-11 px-2 text-xs text-brand disabled:text-sub md:min-h-0" onClick={() => downloadOne(m.id).catch((e: Error) => toast.error(e.message))}>ดาวน์โหลด</button>}
                  <button aria-label={`ลบ ${m.file_name}`} className="press min-h-11 px-2 text-xs text-danger md:min-h-0" onClick={() => setDeleting(m)}>ลบ</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {/* The reason box opens and closes by its grid row (0fr to 1fr, 200 ms); inert while closed. */}
      <div className={`grid transition-[grid-template-rows] duration-200 ${asking ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="min-h-0 overflow-hidden">
          <div inert={!asking} className="flex flex-col gap-2 p-px">
            <Textarea ref={reasonRef} rows={3} aria-label="เหตุผลที่ขอแก้ไข" placeholder="เหตุผลที่ขอแก้ไข (ครีเอเตอร์จะเห็นข้อความนี้)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <span className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { restoreFocus.current = true; setAsking(false) }}>ยกเลิก</Button>
              <Button loading={review.isPending} disabled={!reason.trim()} onClick={requestChanges}>ส่งคำขอแก้ไข</Button>
            </span>
          </div>
        </div>
      </div>
      {!asking && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs">สถานะ: <StatusChip status={clip.status} transitionName={`status-${clipId}`} drawCheck /></span>
          <span className="flex gap-2">
            <Button ref={askRef} variant="outline" className="border-warn-line text-warn-text" disabled={rounds.length === 0} onClick={() => setAsking(true)}>ขอแก้ไข</Button>
            <Button className="bg-success text-white hover:bg-success/90" loading={review.isPending} disabled={rounds.length === 0 || clip.status === 'approved'} onClick={approve}>
              {clip.status === 'approved' ? 'อนุมัติแล้ว ✓' : 'อนุมัติ'}
            </Button>
          </span>
        </div>
      )}
      <ConfirmDialog open={!!deleting} title={`ลบไฟล์ “${lastDeleting?.file_name}”?`} body="ไฟล์ที่ครีเอเตอร์ส่งเป็นหลักฐาน ลบแล้วกู้คืนไม่ได้" confirm="ลบ"
        onConfirm={() => deleting && remove.mutateAsync(deleting.id)} loading={remove.isPending} onClose={() => setDeleting(null)} />
    </section>
  )
}
