import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addDays, addMonths, isSameMonth } from 'date-fns'
import { ArrowLeft, ArrowRight, Clapperboard, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { clipsQuery, dayCountsQuery, useCategories, useClips, useDayCounts, useMe } from '@/api/queries'
import { ClipCard } from '@/components/ClipCard'
import { DayDrawer } from '@/components/DayDrawer'
import { EmptyState } from '@/components/EmptyState'
import { Delayed, Skeleton } from '@/components/bits'
import { DateLabel } from '@/components/DateLabel'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { readableOn } from '@/lib/color'
import { calendarView, dayLabel, fullDate, monthGrid, monthLabel, monthShort, rangeLabel, rememberView, toIso, todayIso, weekDays } from '@/lib/dates'
import type { ClipCardRow, ClipDayCount } from '@/lib/types'

const MAX_CARDS = 4
const SHORT_DAYS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

export function Calendar() {
  const [params, setParams] = useSearchParams()
  const { view, date, days } = calendarView(params)
  const dateIso = toIso(date)
  const { data: me } = useMe()
  const owner = me?.role === 'owner'
  const from = toIso(days[0])
  const to = toIso(days[days.length - 1])
  // Only the view on screen loads: the week's cards, or the month's per-day counts.
  const clips = useClips(from, to, view === 'week')
  const counts = useDayCounts(from, to, view === 'month')
  const [drawer, setDrawer] = useState<string | null>(null)

  const go = (next: { view?: string; date?: string }) => setParams({ view, date: dateIso, ...next })
  // Cells are keyed by position (weekday or index), not date, so they survive a step and <Roll> can animate the number; the grid stays put when you step: only the labels change, and neighbouring ranges are prefetched so the cards are ready.
  const step = (n: number) => { go({ date: toIso(view === 'week' ? addDays(date, 7 * n) : addMonths(date, n)) }) }
  const backToToday = () => { go({ date: todayIso() }) }
  const qc = useQueryClient()
  useEffect(() => {
    rememberView(view)
    for (const n of [-1, 1]) {
      const d = view === 'week' ? addDays(date, 7 * n) : addMonths(date, n)
      const ds = view === 'week' ? weekDays(d) : monthGrid(d)
      const [f, t] = [toIso(ds[0]), toIso(ds[ds.length - 1])]
      if (view === 'week') void qc.prefetchQuery(clipsQuery(f, t))
      else void qc.prefetchQuery(dayCountsQuery(f, t))
    }
  }, [view, dateIso]) // eslint-disable-line react-hooks/exhaustive-deps
  const todayLater = todayIso() > dateIso
  const away = view === 'week' ? !days.some((d) => toIso(d) === todayIso()) : todayIso().slice(0, 7) !== dateIso.slice(0, 7)
  const forDay = (iso: string) => clips.data?.filter((c) => c.date === iso) ?? []
  const countOf = (iso: string) => counts.data?.filter((c) => c.date === iso) ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex">
            <Button variant="outline" size="icon" className="rounded-r-none max-md:size-11" aria-label="ก่อนหน้า" onClick={() => step(-1)}><ChevronLeft /></Button>
            <Button variant="outline" size="icon" className="-ml-px rounded-l-none max-md:size-11" aria-label="ถัดไป" onClick={() => step(1)}><ChevronRight /></Button>
          </div>
          <h2 className="text-lg font-semibold tabular-nums md:w-64">{view === 'week' ? rangeLabel(date) : monthLabel(date)}</h2>
          {/* Always in the layout (hidden when today is on screen), so the toolbar never shifts while stepping. */}
          <button type="button" onClick={backToToday} disabled={!away} tabIndex={away ? 0 : -1} aria-hidden={!away}
            className={`link-action text-sub! text-sm max-md:min-h-11 ${away ? '' : 'invisible'}`}>
            {!todayLater && <ArrowLeft size={14} aria-hidden />}กลับไปวันนี้{todayLater && <ArrowRight size={14} aria-hidden />}
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Segmented label="มุมมองปฏิทิน" value={view} onChange={(v) => go({ view: v })} options={[{ value: 'week', label: 'สัปดาห์' }, { value: 'month', label: 'เดือน' }]} />
          {owner && <Button nativeButton={false} render={<Link viewTransition to={`/clips/new?date=${dateIso}`} />} className="max-md:hidden"><Plus />เพิ่มคลิป</Button>}
        </div>
      </div>

      {/* key restarts the fade-and-rise when the view switches; a view transition would freeze the page and hide the switch's own slide. */}
      <div key={view} className="enter flex flex-col gap-4">
        {view === 'week'
          ? (
            <>
              <MobileDay days={days} selected={date} loading={clips.isPending} failed={clips.isError} forDay={forDay} owner={owner} onPick={(iso) => go({ date: iso })} onOpen={setDrawer} />
              <div className="hidden xl:block"><Week days={days} loading={clips.isPending} forDay={forDay} owner={owner} onOpen={setDrawer} /></div>
            </>
          )
          : <Month days={days} anchor={date} forDay={countOf} onPick={(iso) => go({ view: 'week', date: iso })} />}
      </div>

      {drawer && <DayDrawer date={drawer} onClose={() => setDrawer(null)} />}
      {owner && (
        <Link viewTransition to={`/clips/new?date=${dateIso}`} aria-label="เพิ่มคลิป" className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex size-14 items-center justify-center rounded-full bg-brand text-white shadow-md md:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <Plus />
        </Link>
      )}
    </div>
  )
}

function MobileDay(p: { days: Date[]; selected: Date; loading: boolean; failed: boolean; forDay: (iso: string) => ClipCardRow[]; owner: boolean; onPick: (iso: string) => void; onOpen: (iso: string) => void }) {
  const today = todayIso()
  const selIso = toIso(p.selected)
  const list = p.forDay(selIso)
  return (
    <div className="flex min-w-0 flex-col gap-3 xl:hidden">
      <div className="grid grid-cols-7 gap-1">
        {p.days.map((d) => {
          const iso = toIso(d)
          const sel = iso === selIso
          const hasClips = p.forDay(iso).length > 0
          return (
            <button key={d.getDay()} type="button" aria-pressed={sel} aria-label={fullDate(d)} onClick={() => p.onPick(iso)}
              className={`cell-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand flex h-15.5 min-w-0 flex-col items-center justify-center gap-0.5 rounded-card ${sel ? 'bg-brand text-white' : 'bg-surface'} ${iso === today && !sel ? 'ring-1 ring-brand' : ''}`}>
              <span className="text-xs">{SHORT_DAYS[(d.getDay() + 6) % 7]}</span>
              <b className="text-base tabular-nums">{d.getDate()}</b>
              <span className={`size-1.25 rounded-full ${hasClips ? (sel ? 'bg-white' : 'bg-brand') : ''}`} />
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tabular-nums"><DateLabel date={p.selected} /> <span className="text-sub">·</span> {list.length} คลิป</h2>
        <button type="button" onClick={() => p.onOpen(selIso)} className="link-action min-h-11 px-2 text-sm tabular-nums">ดูทั้งวัน<ChevronRight size={14} aria-hidden /></button>
      </div>
      {p.loading && <Delayed><Skeleton className="h-20" /></Delayed>}
      {list.map((c, i) => <ClipCard key={c.id} clip={c} enterIndex={i} />)}
      {!p.loading && !p.failed && list.length === 0 && (
        <EmptyState icon={Clapperboard} title="ยังไม่มีคลิปในวันนี้" hint={p.owner ? 'กด “เพิ่มคลิป” ด้านล่างเพื่อเริ่มวางแผน' : 'เจ้าของยังไม่ได้ใส่งานของวันนี้'} />
      )}
      {p.owner && (
        <Link viewTransition to={`/clips/new?date=${selIso}`} className="max-md:min-h-11 rounded-card border border-dashed border-line py-3 text-center text-sm text-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">+ เพิ่มคลิป</Link>
      )}
    </div>
  )
}

function Week(p: { days: Date[]; loading: boolean; forDay: (iso: string) => ClipCardRow[]; owner: boolean; onOpen: (iso: string) => void }) {
  const today = todayIso()
  return (
    <div className="grid grid-cols-7 gap-2">
      {p.days.map((d) => {
        const iso = toIso(d)
        const list = p.forDay(iso)
        const isToday = iso === today
        return (
          <section key={d.getDay()} className={`flex flex-col gap-2 rounded-card p-2 min-h-[70vh] ${isToday ? 'border border-brand bg-today' : 'bg-surface'}`}>
            <button onClick={() => p.onOpen(iso)} className={`cell-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-[calc(var(--radius-card)-0.5rem)] py-1 text-center ${isToday ? 'bg-brand text-white' : ''}`}>
              <span className="text-xs">{dayLabel(d)}</span><br /><b className="text-2xl tabular-nums">{d.getDate()}</b><br />
              <span className="text-xs tabular-nums">{list.length} คลิป</span>
            </button>
            {p.loading && <Delayed><Skeleton className="h-20" /></Delayed>}
            {list.slice(0, MAX_CARDS).map((c, i) => <ClipCard key={c.id} clip={c} enterIndex={i} square />)}
            {list.length > MAX_CARDS && (
              <button onClick={() => p.onOpen(iso)} className="link-action self-start text-xs tabular-nums">ดูเพิ่มอีก {list.length - MAX_CARDS} คลิป<ChevronRight size={12} aria-hidden /></button>
            )}
            {!p.loading && list.length === 0 && (
              <EmptyState title="ยังไม่มีคลิป" hint={p.owner ? undefined : 'ไม่มีงานในวันนี้'} className="py-4" />
            )}
            {p.owner && (
              <Link viewTransition to={`/clips/new?date=${iso}`} className="rounded-[calc(var(--radius-card)-0.5rem)] border border-dashed border-line py-1 text-center text-xs text-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">+ เพิ่มคลิป</Link>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Month(p: { days: Date[]; anchor: Date; forDay: (iso: string) => ClipDayCount[]; onPick: (iso: string) => void }) {
  const { data: cats = [] } = useCategories()
  const today = todayIso()
  return (
    <>
      <div>
        <div className="grid grid-cols-7 pb-1 text-center text-xs text-sub">{p.days.slice(0, 7).map((d) => <div key={d.getDay()}>{dayLabel(d)}</div>)}</div>
        {/* Always 6 weeks (42 cells). From md the grid is as tall as the free screen, so the whole month shows without scrolling; on phones the cells are square. days of the neighbouring months fill the spare ones, faded. */}
        <div className="grid grid-cols-7 overflow-hidden rounded-card border border-line md:h-[calc(100dvh-14rem)] md:min-h-112 md:grid-rows-6">
          {p.days.map((d, i) => {
            const iso = toIso(d)
            const list = p.forDay(iso)
            const total = list.reduce((sum, x) => sum + x.n, 0)
            const inMonth = isSameMonth(d, p.anchor)
            const isToday = iso === today
            return (
              <button key={i} onClick={() => p.onPick(iso)} aria-label={fullDate(d)}
                className={`cell-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden border-grid max-md:aspect-square p-1 text-left ${i % 7 < 6 ? 'border-r' : ''} ${i < 35 ? 'border-b' : ''} ${isToday ? 'bg-today' : inMonth ? '' : 'bg-surface'}`}>
                <span className="flex items-start justify-between text-xs tabular-nums">
                  <b className={isToday ? 'grid size-6 place-items-center rounded-full bg-brand text-white' : inMonth ? '' : 'font-normal text-sub'}>{d.getDate()}{!inMonth && d.getDate() === 1 ? ` ${monthShort(d)}` : ''}</b>
                  {total > 0 && <span className="hidden text-sub sm:inline">{total} คลิป</span>}
                </span>
                {cats.map((c) => {
                  const n = list.find((x) => x.category_id === c.id)?.n ?? 0
                  return n > 0 && (
                    <span key={c.id} className={`flex justify-between rounded px-1 text-xs font-bold ${inMonth ? '' : 'opacity-60'}`} style={{ background: c.color, color: readableOn(c.color) }}>
                      <span className="hidden truncate sm:inline">{c.name}</span>
                      <span className="sm:hidden">{c.name.slice(0, 1)}</span>
                      <span className="tabular-nums">{n}</span>
                    </span>
                  )
                })}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-sub sm:hidden">
        {cats.map((c) => (
          <span key={c.id} className="flex items-center gap-1">
            <span className="size-3 rounded-full" style={{ background: c.color }} />{c.name}
          </span>
        ))}
      </div>
    </>
  )
}
