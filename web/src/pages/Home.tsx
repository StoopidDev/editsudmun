import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { ArrowRight, Plus } from 'lucide-react'
import { useAttention, useCategories, useClips, useExpiring, useMe, useRecent, useStorage } from '@/api/queries'
import { shareTitle } from '@/lib/viewTransition'
import { CategoryBadge, Delayed, Skeleton } from '@/components/bits'
import { ClipCard } from '@/components/ClipCard'
import { DownloadAll } from '@/components/media'
import { ATTENTION_LABEL } from '@/lib/attention'
import { Button } from '@/components/ui/button'
import { dayLabel, fromIso, fullDate, rangeLabel, shortDate, toIso, todayIso, weekDays } from '@/lib/dates'
import { readableOn } from '@/lib/color'
import { formatSize } from '@/lib/media'

export function Home() {
  const today = todayIso()
  const now = fromIso(today) // local midnight of today; avoids impure new Date() in render
  const days = weekDays(now)
  const { data: me } = useMe()
  const owner = me?.role === 'owner'
  const week = useClips(toIso(days[0]), toIso(days[6]))
  const recent = useRecent(4)
  const storage = useStorage(owner)
  const attention = useAttention()
  const expiring = useExpiring(owner)
  const todo = attention.data ?? []
  const dying = expiring.data ?? []
  const { data: cats } = useCategories()
  const todays = week.data?.filter((c) => c.date === today) ?? []
  const color = (id: string) => cats?.find((c) => c.id === id)?.color

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ยินดีต้อนรับกลับมา</h1>
        {owner && <Button nativeButton={false} render={<Link viewTransition to={`/clips/new?date=${today}`} />}><Plus />เพิ่มคลิป</Button>}
      </div>

      {todo.length > 0 && (
        <section className="enter flex flex-col gap-2" style={{ '--i': 0 } as CSSProperties}>
          <h2 className="text-lg font-bold">งานของฉัน ({todo.length})</h2>
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {todo.map((c) => (
              <Link viewTransition key={c.id} to={`/clips/${c.id}`} onClick={(e) => shareTitle(e, c.id)} className="press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand flex flex-col gap-1 rounded-card border border-warn-line bg-warn-bg p-3">
                <div className="flex items-center justify-between gap-2 text-xs text-sub">
                  <CategoryBadge categoryId={c.category_id} />
                  <span className="font-bold text-warn-text">{ATTENTION_LABEL[c.attention]} · {shortDate(fromIso(c.date))}</span>
                </div>
                <b data-title className="text-sm">{c.title}</b>
                {c.attention === 'review' && <span className="text-xs text-sub">ครีเอเตอร์ส่งงานแล้ว {c.round} รอบ</span>}
                {c.attention === 'revision' && <p className="line-clamp-2 text-xs">{c.revision_note}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {dying.length > 0 && (
        <section role="status" className="enter flex flex-col gap-1 rounded-card border border-warn-line bg-warn-bg p-3 text-sm" style={{ '--i': 1 } as CSSProperties}>
          <b>มี {dying.length} ไฟล์ใกล้ถูกลบ</b>
          {dying.map((f) => (
            <Link viewTransition key={f.id} to={`/clips/${f.clip_id}`} className="truncate text-xs underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {f.file_name} · {f.clip_title} · ลบใน {f.days} วัน
            </Link>
          ))}
          <div className="self-start pt-1"><DownloadAll ids={dying.map((f) => f.id)} /></div>
        </section>
      )}

      <section className="enter flex flex-col gap-2" style={{ '--i': 2 } as CSSProperties}>
        <div className="flex justify-between">
          <h2 className="text-lg">วันนี้ · {fullDate(now)}</h2>
          <Link viewTransition to="/calendar" className="flex items-center gap-1 text-sm text-brand hover-pointer:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">เปิดปฏิทิน<ArrowRight size={14} /></Link>
        </div>
        {week.isPending ? (<Delayed><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div></Delayed>) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todays.map((c, i) => (
              <div key={c.id} className="enter" style={{ '--i': i } as CSSProperties}>
                <ClipCard clip={c} variant="today" index={i + 1} total={todays.length} />
              </div>
            ))}
            {todays.length === 0 && !owner && !week.isError && <p className="text-sm text-sub">วันนี้ไม่มีคลิป</p>}
            {owner && (
              <Link viewTransition to={`/clips/new?date=${today}`} className="press hover-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand flex min-h-24 flex-col items-center justify-center rounded-card border border-dashed border-line text-sm text-sub">
                <Plus size={16} />เพิ่มคลิปวันนี้
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="enter flex flex-col gap-2" style={{ '--i': 3 } as CSSProperties}>
        <div className="flex justify-between">
          <h2 className="text-lg">สัปดาห์นี้</h2>
          <span className="text-sm text-sub">{rangeLabel(now)} · <Link viewTransition to="/calendar" className="text-brand hover-pointer:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">ดูทั้งหมด</Link></span>
        </div>
        <div className="grid grid-cols-7 overflow-hidden rounded-card border border-line">
          {days.map((d) => {
            const iso = toIso(d)
            const list = week.data?.filter((c) => c.date === iso) ?? []
            return (
              <Link viewTransition key={iso} to={`/calendar?date=${iso}`} className={`cell-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand flex min-h-16 flex-col gap-1 border-r border-grid p-1 last:border-r-0 sm:min-h-24 sm:p-2 ${iso === today ? 'bg-today' : ''}`}>
                <span className={`rounded-card text-center text-xs ${iso === today ? 'bg-brand text-white' : ''}`}>{dayLabel(d)}<br /><b className="text-base">{d.getDate()}</b></span>
                {list.slice(0, 3).map((c) => {
                  const bg = color(c.category_id) ?? '#5f5f5f'
                  return <span key={c.id} className="hidden truncate rounded px-1 text-xs font-bold sm:block" style={{ background: bg, color: readableOn(bg) }}>{c.title}</span>
                })}
                <span className="text-center text-xs text-sub sm:text-left">
                  <span className="sm:hidden">{list.length || ''}</span>
                  <span className="hidden sm:inline">{list.length ? `${list.length} คลิป` : week.isError ? '' : 'ไม่มีคลิป'}</span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="enter flex flex-col gap-2" style={{ '--i': 4 } as CSSProperties}>
        <h2 className="text-lg">แก้ไขล่าสุด</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {recent.data?.map((c) => (
            <Link viewTransition key={c.id} to={`/clips/${c.id}`} onClick={(e) => shareTitle(e, c.id)} className="press hover-tint hover-pointer:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand flex flex-col gap-1 rounded-card border border-line p-3">
              <div className="flex justify-between text-xs text-sub">
                <CategoryBadge categoryId={c.category_id} />
                {formatDistanceToNow(parseISO(c.brief_updated_at), { locale: th, addSuffix: true })}
              </div>
              <b data-title className="text-sm">{c.title}</b>
              <span className="text-xs text-sub">อัปเดตล่าสุด</span>
            </Link>
          ))}
        </div>
      </section>

      {owner && storage.data !== undefined && (
        <section className="enter rounded-card border border-line p-3" style={{ '--i': 5 } as CSSProperties}>
          <h2 className="text-lg">พื้นที่จัดเก็บ</h2>
          <p className="text-sm text-sub">ใช้ไปแล้ว {formatSize(storage.data)}</p>
        </section>
      )}
    </div>
  )
}
