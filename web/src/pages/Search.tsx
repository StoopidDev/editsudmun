import { Link, useSearchParams } from 'react-router-dom'
import { useSearch } from '@/api/queries'
import { CategoryBadge } from '@/components/bits'
import { Input } from '@/components/ui/input'
import { dayLabel, fromIso, shortDate } from '@/lib/dates'
import { snippet } from '@/lib/search'

export function Search() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const { data = [], isFetching, isError } = useSearch(q)

  return (
    <div className="flex flex-col gap-3">
      {/* The full sidebar starts at lg, so this input is the only search box below it. */}
      <Input key={q} className="lg:hidden" aria-label="ค้นหาคลิป" placeholder="ค้นหาคลิป..." defaultValue={q} onKeyDown={(e) => e.key === 'Enter' && setParams({ q: e.currentTarget.value })} />
      {!q && <p className="py-16 text-center text-sm text-sub">พิมพ์ชื่อคลิปหรือคำในสคริปต์ แล้วกด Enter</p>}
      {q && <h1 className="text-lg font-bold">ผลการค้นหา “{q}” {!isFetching && !isError && <span className="text-sm font-normal text-sub">{data.length} คลิป</span>}</h1>}
      {data.map((c) => {
        const hay = [c.script, c.note, c.title].find((t) => t.toLowerCase().includes(q.trim().toLowerCase())) ?? c.script
        const s = snippet(hay, q)
        const d = fromIso(c.date)
        return (
          <Link key={c.id} to={`/clips/${c.id}`} className="flex flex-col gap-1 rounded-card border border-line p-3 hover:bg-surface">
            <div className="flex justify-between text-xs text-sub"><CategoryBadge categoryId={c.category_id} />{dayLabel(d)} {shortDate(d)}</div>
            <b>{c.title}</b>
            <p className="text-xs text-sub">{s.before}<mark className="bg-note-line text-ink">{s.match}</mark>{s.after}</p>
          </Link>
        )
      })}
      {q && !isFetching && !isError && data.length === 0 && (
        <div className="py-16 text-center">
          <p className="font-bold">ไม่พบคลิปที่ตรงกับ “{q}”</p>
          <p className="text-sm text-sub">ลองคำอื่น หรือเช็กการสะกด</p>
        </div>
      )}
    </div>
  )
}
