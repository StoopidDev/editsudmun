import { Link, Navigate, useParams } from 'react-router-dom'
import { Play } from 'lucide-react'
import * as api from '@/api/index'
import { useAct, useClip, useMe, useMedia } from '@/api/queries'
import { BackButton } from '@/components/BackButton'
import { ClipPager } from '@/components/ClipPager'
import { CategoryBadge, Delayed, FileTile, Skeleton, StatusChip, UploadDisabled } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { fromIso, fullDate } from '@/lib/dates'
import { canWithdraw, formatSize, roundCount, withRounds, withdrawMinutesLeft, daysLeft } from '@/lib/media'
import { ClipForm } from './ClipForm'

export function ClipDetail() {
  const { id = '' } = useParams()
  const { data: me } = useMe()
  if (id === 'new') return me?.role === 'owner' ? <ClipForm /> : <Navigate to="/" replace />
  return me?.role === 'owner' ? <ClipForm clipId={id} /> : <CreatorDetail id={id} />
}

function NoteBox({ note, className = '' }: { note: string; className?: string }) {
  return (
    <section className={`rounded-card border border-note-line bg-note p-3 ${className}`}>
      <h2 className="mb-1 text-sm font-bold">หมายเหตุ</h2>
      <ul className="list-disc pl-4 text-sm">{note.split('\n').filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}</ul>
    </section>
  )
}

function CreatorDetail({ id }: { id: string }) {
  const { data: me } = useMe()
  const { data: clip, isPending } = useClip(id)
  const { data: media = [] } = useMedia(id)
  const withdraw = useAct(api.withdrawMedia)

  if (isPending) return (
    <Delayed>
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3"><Skeleton className="h-9 w-2/3" /><Skeleton className="h-64" /></div>
        <div className="flex w-full flex-col gap-3 md:w-80"><Skeleton className="h-32" /><Skeleton className="h-40" /></div>
      </div>
    </Delayed>
  )
  if (!clip) return <p>ไม่พบคลิป <Link to="/calendar" className="text-brand">กลับปฏิทิน</Link></p>

  const refs = media.filter((m) => m.purpose === 'reference')
  const rounds = withRounds(media.filter((m) => m.purpose === 'submission'))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackButton fallback={`/calendar?date=${clip.date}`} />
        <ClipPager clipId={id} date={clip.date} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3 max-lg:contents">
          <div className="flex items-center gap-2 text-sm text-sub">
            <CategoryBadge categoryId={clip.category_id} />{fullDate(fromIso(clip.date))}<StatusChip status={clip.status} />
          </div>
          <h1 className="text-3xl font-bold">{clip.title}</h1>
          {clip.status === 'revision' && (
            <div role="status" className="rounded-card border border-warn-line bg-warn-bg p-3 text-sm">
              <b>เจ้าของขอให้แก้ไข</b><p>{clip.revision_note}</p>
            </div>
          )}
          <section className="rounded-card border border-line p-4 max-lg:order-2">
            <h2 className="mb-2 text-sm font-bold text-sub">สคริปต์</h2>
            <p className="text-lg leading-loose whitespace-pre-wrap">{clip.script}</p>
          </section>
        </div>

        <div className="flex flex-col gap-3 max-lg:contents">
          {clip.note && <NoteBox note={clip.note} className="max-lg:order-1" />}
          <section className="rounded-card border border-line p-3 max-lg:order-3">
            <h2 className="mb-2 text-sm font-bold">ไฟล์อ้างอิง {refs.length} ไฟล์</h2>
            <div className="grid grid-cols-3 gap-2">{refs.map((f) => <FileTile key={f.id} file={f} clipDate={clip.date} />)}</div>
          </section>
          <section className="flex flex-col gap-2 rounded-card border border-line p-3 max-lg:order-4">
            <h2 className="flex justify-between text-sm font-bold">ส่งงาน<span className="text-xs font-normal text-sub">ไฟล์ที่ตัดต่อแล้ว · MP4 ≤ 2 GB</span></h2>
            <UploadDisabled label="ลากไฟล์มาวาง หรือ คลิกเพื่อเลือกไฟล์" />
            <h3 className="text-xs font-bold">ส่งแล้ว ({roundCount(rounds)} รอบ)</h3>
            {rounds.map((m) => (
              <div key={m.id} className="flex flex-col gap-2 rounded-card border border-grid p-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-today text-brand"><Play size={14} /></span>
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="mr-1 rounded bg-surface px-1 text-xs font-bold">รอบ {m.round}</span><b className="truncate">{m.file_name}</b>
                    <div className="text-xs text-sub">{formatSize(m.size_bytes)} · ลบใน {daysLeft(m.expires_at)} วัน</div>
                  </div>
                </div>
                {me && canWithdraw(m, me.id) && (
                  <Button variant="outline" className="min-h-11 border-danger text-danger md:min-h-0" loading={withdraw.isPending} onClick={() => withdraw.mutate(m.id)}>
                    ถอนไฟล์นี้ (เหลือ {withdrawMinutesLeft(m)} นาที)
                  </Button>
                )}
              </div>
            ))}
            <p className="text-xs text-sub">ถอนไฟล์ได้ภายใน 10 นาทีหลังส่ง หลังจากนั้นไฟล์จะถูกล็อก และแก้ไขได้ด้วยการส่งรอบใหม่</p>
          </section>
        </div>
      </div>
    </div>
  )
}
