import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addDays, addMonths, isSameMonth, isValid } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useCategories, useClips, useMe, withTransition } from '@/api/queries'
import { ClipCard } from '@/components/ClipCard'
import { DayDrawer } from '@/components/DayDrawer'
import { Delayed, Skeleton } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { readableOn } from '@/lib/color'
import { dayLabel, fromIso, fullDate, monthGrid, monthLabel, rangeLabel, shortDate, toIso, todayIso, weekDays } from '@/lib/dates'
import type { ClipCardRow } from '@/lib/types'

const MAX_CARDS = 4
const SHORT_DAYS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

export function Calendar() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'month' ? 'month' : 'week'
  const parsed = fromIso(params.get('date') ?? '')
  const date = isValid(parsed) ? parsed : fromIso(todayIso())
  const dateIso = toIso(date)
  const days = view === 'week' ? weekDays(date) : monthGrid(date)
  const { data: me } = useMe()
  const owner = me?.role === 'owner'
  const clips = useClips(toIso(days[0]), toIso(days[days.length - 1]))
  const [drawer, setDrawer] = useState<string | null>(null)

  const go = (next: { view?: string; date?: string }) => setParams({ view, date: dateIso, ...next })
  // Later weeks slide in from the right, earlier from the left (CSS reads data-dir).
  const step = (n: number) => {
    document.documentElement.dataset.dir = n > 0 ? 'next' : 'prev'
    withTransition(() => go({ date: toIso(view === 'week' ? addDays(date, 7 * n) : addMonths(date, n)) }))
  }
  const forDay = (iso: string) => clips.data?.filter((c) => c.date === iso) ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" className="max-md:size-11" aria-label="ก่อนหน้า" onClick={() => step(-1)}><ChevronLeft /></Button>
        <b className="text-lg">{view === 'week' ? rangeLabel(date) : monthLabel(date)}</b>
        <Button variant="outline" size="icon" className="max-md:size-11" aria-label="ถัดไป" onClick={() => step(1)}><ChevronRight /></Button>
        <Button variant="outline" onClick={() => go({ date: todayIso() })}>วันนี้</Button>
        <div className="flex rounded-card border border-line p-0.5">
          {(['week', 'month'] as const).map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => go({ view: v })} className={`rounded-md px-3 py-1 text-sm max-md:min-h-11 ${view === v ? 'bg-brand text-white' : ''}`}>
              {v === 'week' ? 'สัปดาห์' : 'เดือน'}
            </button>
          ))}
        </div>
        {owner && <Button nativeButton={false} render={<Link viewTransition to={`/clips/new?date=${dateIso}`} />} className="ml-auto max-md:hidden"><Plus />เพิ่มคลิป</Button>}
      </div>

      {view === 'week'
        ? (
          <>
            <MobileDay days={days} selected={date} loading={clips.isPending} failed={clips.isError} forDay={forDay} owner={owner} onPick={(iso) => go({ date: iso })} onOpen={setDrawer} />
            <div className="hidden xl:block"><Week days={days} loading={clips.isPending} forDay={forDay} owner={owner} onOpen={setDrawer} /></div>
          </>
        )
        : <Month days={days} anchor={date} forDay={forDay} onPick={(iso) => go({ view: 'week', date: iso })} />}

      {drawer && <DayDrawer date={drawer} onClose={() => setDrawer(null)} />}
      {owner && (
        <Link viewTransition to={`/clips/new?date=${dateIso}`} aria-label="เพิ่มคลิป" className="fixed right-4 bottom-20 z-10 flex size-14 items-center justify-center rounded-full bg-brand text-white shadow-md md:hidden">
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
    <div className="flex min-w-0 flex-col gap-3 xl:hidden" style={{ viewTransitionName: 'cal' }}>
      <div className="grid grid-cols-7 gap-1">
        {p.days.map((d) => {
          const iso = toIso(d)
          const sel = iso === selIso
          const hasClips = p.forDay(iso).length > 0
          return (
            <button key={iso} type="button" aria-pressed={sel} aria-label={fullDate(d)} onClick={() => p.onPick(iso)}
              className={`flex h-[62px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-card ${sel ? 'bg-brand text-white' : 'bg-surface'} ${iso === today && !sel ? 'ring-1 ring-brand' : ''}`}>
              <span className="text-xs">{SHORT_DAYS[(d.getDay() + 6) % 7]}</span>
              <b className="text-base">{d.getDate()}</b>
              <span className={`size-[5px] rounded-full ${hasClips ? (sel ? 'bg-white' : 'bg-brand') : ''}`} />
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">{dayLabel(p.selected)} {shortDate(p.selected)} · {list.length} คลิป</h2>
        <button type="button" onClick={() => p.onOpen(selIso)} className="min-h-11 px-2 text-sm text-brand hover-pointer:underline underline-offset-4">ดูทั้งวัน</button>
      </div>
      {p.loading && <Delayed><Skeleton className="h-20" /></Delayed>}
      {list.map((c) => <ClipCard key={c.id} clip={c} />)}
      {!p.loading && !p.failed && list.length === 0 && <p className="py-2 text-center text-sm text-sub">ไม่มีคลิป</p>}
      {p.owner && (
        <Link viewTransition to={`/clips/new?date=${selIso}`} className="rounded-card border border-dashed border-line py-3 text-center text-sm text-sub">+ เพิ่มคลิป</Link>
      )}
    </div>
  )
}

function Week(p: { days: Date[]; loading: boolean; forDay: (iso: string) => ClipCardRow[]; owner: boolean; onOpen: (iso: string) => void }) {
  const today = todayIso()
  return (
    <div className="grid grid-cols-7 gap-2" style={{ viewTransitionName: 'cal' }}>
      {p.days.map((d) => {
        const iso = toIso(d)
        const list = p.forDay(iso)
        const isToday = iso === today
        return (
          <section key={iso} className={`flex flex-col gap-2 rounded-card p-2 min-h-[70vh] ${isToday ? 'border border-brand bg-today' : 'bg-surface'}`}>
            <button onClick={() => p.onOpen(iso)} className={`press hover-tint rounded-card py-1 text-center ${isToday ? 'bg-brand text-white' : ''}`}>
              <span className="text-xs">{dayLabel(d)}</span><br /><b className="text-xl">{d.getDate()}</b><br />
              <span className="text-xs">{list.length} คลิป</span>
            </button>
            {p.loading && <Delayed><Skeleton className="h-20" /></Delayed>}
            {list.slice(0, MAX_CARDS).map((c) => <ClipCard key={c.id} clip={c} />)}
            {list.length > MAX_CARDS && (
              <button onClick={() => p.onOpen(iso)} className="text-xs text-brand hover-pointer:underline underline-offset-4">ดูเพิ่มอีก {list.length - MAX_CARDS} คลิป</button>
            )}
            {p.owner && (
              <Link viewTransition to={`/clips/new?date=${iso}`} className="rounded-card border border-dashed border-line py-1 text-center text-xs text-sub">+ เพิ่มคลิป</Link>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Month(p: { days: Date[]; anchor: Date; forDay: (iso: string) => ClipCardRow[]; onPick: (iso: string) => void }) {
  const { data: cats = [] } = useCategories()
  const today = todayIso()
  return (
    <>
    <div className="grid grid-cols-7 overflow-hidden rounded-card border border-line">
      {p.days.slice(0, 7).map((d) => <div key={d.getDay()} className="border-b border-grid py-1 text-center text-xs text-sub">{dayLabel(d)}</div>)}
      {p.days.map((d) => {
        const iso = toIso(d)
        const list = p.forDay(iso)
        const inMonth = isSameMonth(d, p.anchor)
        return (
          <button key={iso} onClick={() => p.onPick(iso)} className={`press hover-tint flex min-h-20 flex-col gap-1 border-r border-b border-grid p-1 text-left md:min-h-28 ${iso === today ? 'bg-today' : inMonth ? '' : 'bg-surface opacity-60'}`}>
            <span className="flex justify-between text-xs"><b>{d.getDate()}</b>{list.length > 0 && <span className="hidden text-sub sm:inline">{list.length} คลิป</span>}</span>
            {cats.map((c) => {
              const n = list.filter((x) => x.category_id === c.id).length
              return n > 0 && (
                <span key={c.id} className="flex justify-between rounded px-1 text-xs font-bold" style={{ background: c.color, color: readableOn(c.color) }}>
                  <span className="hidden truncate sm:inline">{c.name}</span>
                  <span className="sm:hidden">{c.name.slice(0, 1)}</span>
                  <span>{n}</span>
                </span>
              )
            })}
          </button>
        )
      })}
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
