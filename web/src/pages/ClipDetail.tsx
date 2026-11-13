import { useEffect, useState, type CSSProperties } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Play } from 'lucide-react'
import * as api from '@/api/index'
import { useAct, useClip, useMe, useMedia } from '@/api/queries'
import { BackButton } from '@/components/BackButton'
import { ClipPager } from '@/components/ClipPager'
import { CategoryBadge, Delayed, FileTile, MoreTile, Skeleton, StatusChip } from '@/components/bits'
import { useLightbox } from '@/components/useLightbox'
import { useViewUrls, viewables } from '@/lib/viewer'
import { UploadZone } from '@/components/UploadZone'
import { Button } from '@/components/ui/button'
import { DateLabel } from '@/components/DateLabel'
import { sentAt } from '@/lib/dates'
import { canWithdraw, daysLeft, formatSize, readyIds, roundCount, shownTiles, TILE_CAP, WITHDRAW_MS, withRounds, withdrawMinutesLeft } from '@/lib/media'
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
      <h2 className="mb-1 flex items-center gap-1.5 text-sm font-bold"><FileText size={14} aria-hidden />หมายเหตุ</h2>
      <ul className="max-w-[65ch] list-disc pl-4 text-base leading-6.5">{note.split('\n').filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}</ul>
    </section>
  )
}

function CreatorDetail({ id }: { id: string }) {
  const { data: me } = useMe()
  const { data: clip, isPending } = useClip(id)
  const { data: media = [] } = useMedia(id)
  const urls = useViewUrls(readyIds(media))
  const withdraw = useAct(api.withdrawMedia)
  const lb = useLightbox()
  // Re-render every 30 s so the withdraw countdown and its fade stay current.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  // Also wake at the exact moment the next withdraw window closes, so the button hides on time.
  const nextClose = Math.min(...media
    .filter((m) => m.purpose === 'submission' && m.uploaded_by === me?.id)
    .flatMap((m) => (m.ready_at ? [Date.parse(m.ready_at) + WITHDRAW_MS] : []))
    .filter((t) => t > now.getTime()))
  useEffect(() => {
    if (!Number.isFinite(nextClose)) return
    const t = setTimeout(() => setNow(new Date()), nextClose - Date.now() + 100)
    return () => clearTimeout(t)
  }, [nextClose])

  if (isPending) return (
    <Delayed>
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3"><Skeleton className="h-9 w-2/3" /><Skeleton className="h-64" /></div>
        <div className="flex w-full flex-col gap-3 md:w-80"><Skeleton className="h-32" /><Skeleton className="h-40" /></div>
      </div>
    </Delayed>
  )
  if (!clip) return <p>ไม่พบคลิป <Link viewTransition to="/calendar" className="link-action max-md:min-h-11"><ArrowLeft size={14} aria-hidden />กลับปฏิทิน</Link></p>

  const refs = media.filter((m) => m.purpose === 'reference')
  const rounds = withRounds(media.filter((m) => m.purpose === 'submission'))
  const refViews = viewables(refs, urls)
  const tiles = shownTiles(refs)
  const hidden = refs.length - tiles.length
  const subViews = viewables(rounds, urls)
  const minDays = refs.length ? Math.min(...refs.map((f) => daysLeft(f.expires_at))) : null
  const anyWithdraw = !!me && rounds.some((m) => canWithdraw(m, me.id, now))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackButton fallback={`/calendar?date=${clip.date}`} />
        <ClipPager clipId={id} date={clip.date} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3 max-lg:contents">
          <div className="flex items-center gap-2 text-sm font-normal text-sub">
            <CategoryBadge categoryId={clip.category_id} /><DateLabel date={clip.date} /><StatusChip status={clip.status} />
          </div>
          <h1 className="text-[32px] leading-[1.3] font-bold" style={{ viewTransitionName: `title-${id}` }}>{clip.title}</h1>
          {clip.status === 'revision' && (
            <div role="status" className="rounded-card border border-warn-line bg-warn-bg p-3 text-sm">
              <b>เจ้าของขอให้แก้ไข</b><p>{clip.revision_note}</p>
            </div>
          )}
          <section className="rounded-card border border-line p-4 max-lg:order-2">
            <h2 className="mb-2 text-sm font-bold text-sub">สคริปต์</h2>
            <p className="max-w-[65ch] text-xl leading-8.5 whitespace-pre-wrap">{clip.script}</p>
          </section>
        </div>

        <div className="flex flex-col gap-3 max-lg:contents">
          {clip.note && <NoteBox note={clip.note} className="max-lg:order-1" />}
          <section className="flex flex-col gap-2 rounded-card border border-line p-3 max-lg:order-3">
            <h2 className="flex items-baseline justify-between gap-2 text-sm font-bold tabular-nums">
              ไฟล์อ้างอิง {refs.length} ไฟล์
              <span className="text-xs font-normal text-sub">แตะรูปเพื่อดูขยาย</span>
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {tiles.map((f) => (
                <FileTile key={f.id} file={f} clipDate={clip.date} url={urls[f.id]}
                  onOpen={urls[f.id] ? (el) => lb.openAt(refViews, refViews.findIndex((v) => v.id === f.id), el) : undefined} />
              ))}
              {hidden > 0 && (
                <MoreTile count={hidden} onOpen={(el) => {
                  // The "+n" tile opens at the first hidden file; none if that file has no URL yet.
                  const i = refViews.findIndex((v) => v.id === refs[TILE_CAP - 1].id)
                  if (i >= 0) lb.openAt(refViews, i, el)
                }} />
              )}
            </div>
            {minDays !== null && (
              <p className="text-xs font-normal text-sub tabular-nums">ไฟล์อ้างอิงจะถูกลบอัตโนมัติใน {minDays} วัน · ดาวน์โหลดไว้ก่อนได้</p>
            )}
          </section>

          <section className="flex flex-col gap-2 rounded-card border border-line p-3 max-lg:order-4">
            <h2 className="flex items-baseline justify-between gap-2 text-sm font-bold">
              ส่งงาน
              <span className="text-xs font-normal text-sub">ไฟล์ตัดต่อเสร็จ · MP4 ≤ 2 GB</span>
            </h2>
            <UploadZone clipId={id} purpose="submission" />
            <h3 className="text-xs font-bold tabular-nums">ส่งแล้ว ({roundCount(rounds)} รอบ)</h3>
            {rounds.map((m, i) => {
              const left = withdrawMinutesLeft(m, now)
              const open = !!me && canWithdraw(m, me.id, now)
              const view = subViews.findIndex((v) => v.id === m.id)
              return (
                <div key={m.id} style={{ '--i': i } as CSSProperties} className="enter flex flex-col gap-2 rounded-card border border-grid p-2">
                  <div className="flex min-h-14.5 items-center gap-2">
                    {view >= 0 && (
                      <button type="button" aria-label={`เปิด ${m.file_name}`}
                        onClick={(e) => lb.openAt(subViews, view, e.currentTarget)}
                        className="press flex size-8 max-md:min-h-11 max-md:min-w-11 shrink-0 items-center justify-center rounded-full bg-today text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                        <Play size={14} />
                      </button>
                    )}
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 rounded-card bg-surface px-1.5 text-xs font-bold tabular-nums">รอบ {m.round}</span>
                        <b className="truncate">{m.file_name}</b>
                      </div>
                      <div className="text-xs text-sub tabular-nums">{formatSize(m.size_bytes)} · ส่งเมื่อ {sentAt(m.created_at)}</div>
                    </div>
                    <span className="shrink-0 text-xs font-normal text-sub tabular-nums">ลบใน {daysLeft(m.expires_at)} วัน</span>
                  </div>
                  {me && m.uploaded_by === me.id && (
                    // Collapses instead of unmounting, so the withdraw button fades out when its window closes.
                    <div inert={!open} className={`grid transition-[grid-template-rows,opacity] duration-200 ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="min-h-0 overflow-hidden">
                        <Button variant="outline" className="w-full border-danger text-danger tabular-nums max-md:min-h-11"
                          loading={withdraw.isPending} onClick={() => withdraw.mutate(m.id)}>
                          ถอนไฟล์นี้ (เหลือ {left} นาที)
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            <p className="text-xs font-normal text-sub">
              {anyWithdraw ? 'ถอนไฟล์ได้ภายใน 10 นาทีหลังส่ง หลังจากนั้นล็อก และแก้ไม่ได้ ต้องส่งเป็นรอบใหม่' : 'ส่งแล้วลบหรือแก้ไม่ได้ ถ้าต้องแก้ให้ส่งเป็นรอบใหม่'}
            </p>
          </section>
        </div>
      </div>
      {lb.node}
    </div>
  )
}
