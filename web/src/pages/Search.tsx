import type { CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, SearchX } from 'lucide-react'
import { useSearch } from '@/api/queries'
import { CategoryBadge, Delayed, Skeleton } from '@/components/bits'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { dayLabel, fromIso, shortDate } from '@/lib/dates'
import { snippet } from '@/lib/search'

export function Search() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''

  return (
    <div className="flex flex-col gap-3">
      {/* The full sidebar starts at lg, so this input is the only search box below it. */}
      <Input key={q} className="lg:hidden" aria-label="ค้นหาคลิป" placeholder="ค้นหาคลิป..." defaultValue={q} onKeyDown={(e) => e.key === 'Enter' && setParams({ q: e.currentTarget.value })} />
      {!q && <EmptyState icon={SearchIcon} title="ค้นหาคลิป" hint="พิมพ์ชื่อคลิปหรือคำในสคริปต์ แล้วกด Enter" />}
      {q && <Results key={q} q={q} />}
    </div>
  )
}

// Keyed by the query, so a new search starts a new request.
function Results({ q }: { q: string }) {
  const { data: pages, isPending, isFetching, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useSearch(q)
  const data = pages?.pages.flatMap((p) => p.rows) ?? []
  const total = pages?.pages[0]?.total ?? 0

  return (
    <>
      <h1 className="text-lg font-bold">ผลการค้นหา “{q}” {!isPending && !isError && <span className="text-sm font-normal text-sub tabular-nums">{total} คลิป</span>}</h1>
      {isFetching && data.length === 0 && (
        <Delayed><div className="flex flex-col gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div></Delayed>
      )}
      {data.map((c, i) => {
        const hay = [c.script, c.note, c.title].find((t) => t.toLowerCase().includes(q.trim().toLowerCase())) ?? c.script
        const s = snippet(hay, q)
        const d = fromIso(c.date)
        return (
          <div key={c.id} className="enter" style={{ '--i': i } as CSSProperties}>
            <Link viewTransition to={`/clips/${c.id}`} className="press hover-tint hover-pointer:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand flex flex-col gap-1 rounded-card border border-line p-3">
              <div className="flex justify-between text-xs text-sub tabular-nums"><CategoryBadge categoryId={c.category_id} />{dayLabel(d)} {shortDate(d)}</div>
              <b>{c.title}</b>
              <p className="max-w-[65ch] text-xs text-sub">{s.before}<mark className="bg-note-line text-ink">{s.match}</mark>{s.after}</p>
            </Link>
          </div>
        )
      })}
      {hasNextPage && (
        <Button variant="outline" className="self-center tabular-nums max-md:min-h-11" loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
          ดูเพิ่ม ({total - data.length} คลิป)
        </Button>
      )}
      {!isFetching && !isError && data.length === 0 && (
        <EmptyState icon={SearchX} title={`ไม่พบคลิปที่ตรงกับ “${q}”`} hint="ลองคำอื่น หรือเช็กการสะกด" />
      )}
    </>
  )
}
