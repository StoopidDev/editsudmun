import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addDays, addMonths, isSameMonth, isValid } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useCategories, useClips, useMe } from '@/api/queries'
import { ClipCard } from '@/components/ClipCard'
import { DayDrawer } from '@/components/DayDrawer'
import { Button } from '@/components/ui/button'
import { dayLabel, fromIso, monthGrid, monthLabel, rangeLabel, toIso, todayIso, weekDays } from '@/lib/dates'
import type { ClipCardRow } from '@/lib/types'

const MAX_CARDS = 4

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
  const step = (n: number) => go({ date: toIso(view === 'week' ? addDays(date, 7 * n) : addMonths(date, n)) })
  const forDay = (iso: string) => clips.data?.filter((c) => c.date === iso) ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="ก่อนหน้า" onClick={() => step(-1)}><ChevronLeft /></Button>
        <b className="text-lg">{view === 'week' ? rangeLabel(date) : monthLabel(date)}</b>
        <Button variant="outline" size="icon" aria-label="ถัดไป" onClick={() => step(1)}><ChevronRight /></Button>
        <Button variant="outline" onClick={() => go({ date: todayIso() })}>วันนี้</Button>
        <div className="flex rounded-card border border-line p-0.5">
          {(['week', 'month'] as const).map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => go({ view: v })} className={`rounded-md px-3 py-1 text-sm ${view === v ? 'bg-brand text-white' : ''}`}>
              {v === 'week' ? 'สัปดาห์' : 'เดือน'}
            </button>
          ))}
        </div>
        {owner && <Button nativeButton={false} render={<Link to={`/clips/new?date=${dateIso}`} />} className="ml-auto"><Plus />เพิ่มคลิป</Button>}
      </div>

      {view === 'week'
        ? <Week days={days} loading={clips.isPending} forDay={forDay} owner={owner} onOpen={setDrawer} />
        : <Month days={days} anchor={date} forDay={forDay} onPick={(iso) => go({ view: 'week', date: iso })} />}

      {drawer && <DayDrawer date={drawer} onClose={() => setDrawer(null)} />}
    </div>
  )
}

function Week(p: { days: Date[]; loading: boolean; forDay: (iso: string) => ClipCardRow[]; owner: boolean; onOpen: (iso: string) => void }) {
  const today = todayIso()
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
      {p.days.map((d) => {
        const iso = toIso(d)
        const list = p.forDay(iso)
        const isToday = iso === today
        return (
          <section key={iso} className={`flex flex-col gap-2 rounded-card p-2 md:min-h-[70vh] ${isToday ? 'border border-brand bg-today' : 'bg-surface'}`}>
            <button onClick={() => p.onOpen(iso)} className={`rounded-card py-1 text-center ${isToday ? 'bg-brand text-white' : ''}`}>
              <span className="text-xs">{dayLabel(d)}</span><br /><b className="text-xl">{d.getDate()}</b><br />
              <span className="text-xs">{list.length} คลิป</span>
            </button>
            {p.loading && <div className="h-20 rounded-card bg-grid" aria-label="กำลังโหลด" />}
            {list.slice(0, MAX_CARDS).map((c) => <ClipCard key={c.id} clip={c} />)}
            {list.length > MAX_CARDS && (
              <button onClick={() => p.onOpen(iso)} className="text-xs text-brand">ดูเพิ่มอีก {list.length - MAX_CARDS} คลิป</button>
            )}
            {p.owner && (
              <Link to={`/clips/new?date=${iso}`} className="rounded-card border border-dashed border-line py-1 text-center text-xs text-sub">+ เพิ่มคลิป</Link>
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
    <div className="grid grid-cols-7 overflow-hidden rounded-card border border-line">
      {p.days.slice(0, 7).map((d) => <div key={d.getDay()} className="border-b border-grid py-1 text-center text-xs text-sub">{dayLabel(d)}</div>)}
      {p.days.map((d) => {
        const iso = toIso(d)
        const list = p.forDay(iso)
        const inMonth = isSameMonth(d, p.anchor)
        return (
          <button key={iso} onClick={() => p.onPick(iso)} className={`flex min-h-20 flex-col gap-1 border-r border-b border-grid p-1 text-left md:min-h-28 ${iso === today ? 'bg-today' : inMonth ? '' : 'bg-surface opacity-60'}`}>
            <span className="flex justify-between text-xs"><b>{d.getDate()}</b>{list.length > 0 && <span className="hidden text-sub sm:inline">{list.length} คลิป</span>}</span>
            {cats.map((c) => {
              const n = list.filter((x) => x.category_id === c.id).length
              return n > 0 && (
                <span key={c.id} className="flex justify-between rounded px-1 text-xs font-bold text-white" style={{ background: c.color }}>
                  <span className="hidden truncate sm:inline">{c.name}</span><span>{n}</span>
                </span>
              )
            })}
          </button>
        )
      })}
    </div>
  )
}
