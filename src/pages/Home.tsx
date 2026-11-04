import { Link } from 'react-router-dom'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { ArrowRight, Plus } from 'lucide-react'
import { useCategories, useClips, useMe, useRecent, useStorage } from '@/api/queries'
import { CategoryBadge } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { dayLabel, fromIso, fullDate, rangeLabel, toIso, todayIso, weekDays } from '@/lib/dates'
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
  const { data: cats } = useCategories()
  const todays = week.data?.filter((c) => c.date === today) ?? []
  const color = (id: string) => cats?.find((c) => c.id === id)?.color

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ยินดีต้อนรับกลับมา</h1>
        {owner && <Button nativeButton={false} render={<Link to={`/clips/new?date=${today}`} />}><Plus />เพิ่มคลิป</Button>}
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex justify-between">
          <h2 className="text-lg">วันนี้ · {fullDate(now)}</h2>
          <Link to="/calendar" className="flex items-center gap-1 text-sm text-brand">เปิดปฏิทิน<ArrowRight size={14} /></Link>
        </div>
        {week.isPending ? <p className="text-sm text-sub">กำลังโหลด...</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todays.map((c, i) => (
              <Link key={c.id} to={`/clips/${c.id}`} className="flex flex-col gap-1 rounded-card border border-line p-3 hover:bg-surface">
                <div className="flex justify-between text-xs text-sub"><CategoryBadge categoryId={c.category_id} />คลิป {i + 1} จาก {todays.length}</div>
                <b>{c.title}</b>
                <p className="line-clamp-2 text-xs text-sub">{c.script}</p>
              </Link>
            ))}
            {todays.length === 0 && !owner && !week.isError && <p className="text-sm text-sub">วันนี้ไม่มีคลิป</p>}
            {owner && (
              <Link to={`/clips/new?date=${today}`} className="flex min-h-24 flex-col items-center justify-center rounded-card border border-dashed border-line text-sm text-sub">
                <Plus size={16} />เพิ่มคลิปวันนี้
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex justify-between">
          <h2 className="text-lg">สัปดาห์นี้</h2>
          <span className="text-sm text-sub">{rangeLabel(now)} · <Link to="/calendar" className="text-brand">ดูทั้งหมด</Link></span>
        </div>
        <div className="grid grid-cols-1 overflow-hidden rounded-card border border-line sm:grid-cols-7">
          {days.map((d) => {
            const iso = toIso(d)
            const list = week.data?.filter((c) => c.date === iso) ?? []
            return (
              <Link key={iso} to={`/calendar?date=${iso}`} className={`flex min-h-24 flex-col gap-1 border-grid p-2 sm:border-r ${iso === today ? 'bg-today' : ''}`}>
                <span className={`rounded-card text-center text-xs ${iso === today ? 'bg-brand text-white' : ''}`}>{dayLabel(d)}<br /><b className="text-base">{d.getDate()}</b></span>
                {list.slice(0, 3).map((c) => (
                  <span key={c.id} className="truncate rounded px-1 text-xs font-bold text-white" style={{ background: color(c.category_id) }}>{c.title}</span>
                ))}
                <span className="text-xs text-sub">{list.length ? `${list.length} คลิป` : week.isError ? '' : 'ไม่มีคลิป'}</span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">แก้ไขล่าสุด</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {recent.data?.map((c) => (
            <Link key={c.id} to={`/clips/${c.id}`} className="flex flex-col gap-1 rounded-card border border-line p-3 hover:bg-surface">
              <div className="flex justify-between text-xs text-sub">
                <CategoryBadge categoryId={c.category_id} />
                {formatDistanceToNow(parseISO(c.updated_at), { locale: th, addSuffix: true })}
              </div>
              <b className="text-sm">{c.title}</b>
              <span className="text-xs text-sub">อัปเดตล่าสุด</span>
            </Link>
          ))}
        </div>
      </section>

      {owner && storage.data !== undefined && (
        <section className="rounded-card border border-line p-3">
          <h2 className="text-lg">พื้นที่จัดเก็บ</h2>
          <p className="text-sm text-sub">ใช้ไปแล้ว {formatSize(storage.data)}</p>
        </section>
      )}
    </div>
  )
}
