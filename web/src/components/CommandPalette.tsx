import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Home, Plus, Search, Tag, Users } from 'lucide-react'
import { useMe, useSearch } from '@/api/queries'
import { CategoryBadge, Delayed, Skeleton } from '@/components/bits'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DateLabel } from '@/components/DateLabel'
import { fromIso } from '@/lib/dates'
import { snippet } from '@/lib/search'

const SHORTCUTS = [
  { to: '/', label: 'หน้าแรก', icon: Home, owner: false },
  { to: '/calendar', label: 'ปฏิทิน', icon: Calendar, owner: false },
  { to: '/search', label: 'ค้นหาทั้งหมด', icon: Search, owner: false },
  { to: '/clips/new', label: 'เพิ่มคลิป', icon: Plus, owner: true },
  { to: '/categories', label: 'ประเภทคลิป', icon: Tag, owner: true },
  { to: '/users', label: 'ผู้ใช้งาน', icon: Users, owner: true },
]

const KBD = 'rounded border border-line px-1.5 text-xs text-sub'

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const [query, setQuery] = useState('')
  const [deferred, setDeferred] = useState('')
  // -1 means no active row: Enter then goes to the full search.
  const [active, setActive] = useState(-1)
  const listId = useId()

  // Reset when the palette closes, whatever closed it (Esc, a pick, Ctrl K). Done during render, not in an effect.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) { setQuery(''); setActive(-1) }
  }

  useEffect(() => {
    const t = setTimeout(() => setDeferred(query.trim()), 200)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, listId])

  const q = query.trim()
  // The hook is disabled for an empty query, so no request runs until the first search.
  const { data: pages, isPending, isError } = useSearch(deferred)
  const hits = (pages?.pages.flatMap((p) => p.rows) ?? []).slice(0, 8)
  const shortcuts = SHORTCUTS.filter((s) => !s.owner || me?.role === 'owner')
  const seeAll = `/search?q=${encodeURIComponent(q)}`
  // Keyboard targets, in the order the rows render (the see-all row is last).
  const targets = q ? [...hits.map((c) => `/clips/${c.id}`), seeAll] : shortcuts.map((s) => s.to)
  const searching = !!deferred && isPending
  const empty = !!deferred && !isPending && !isError && hits.length === 0

  const go = (to: string) => {
    onOpenChange(false)
    navigate(to, { viewTransition: true })
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return // Thai IME: Enter confirms the composition, not a pick
    const n = targets.length
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % n : i <= 0 ? n - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const to = targets[active] ?? (q ? seeAll : undefined)
      if (to) go(to)
    }
  }

  const opt = (i: number, to: string, content: ReactNode) => (
    <div key={to} id={`${listId}-${i}`} role="option" aria-selected={i === active}
      onMouseEnter={() => setActive(i)} onClick={() => go(to)}
      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-card px-3 py-2 transition-[background-color,box-shadow] duration-100 ${i === active ? 'bg-[color-mix(in_oklab,var(--c-brand)_16%,transparent)]' : ''}`}>
      {content}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}
        className="top-[12vh] translate-y-0 w-full max-w-xl sm:max-w-xl gap-0 p-0 overflow-hidden rounded-xl">
        <DialogTitle className="sr-only">ค้นหาคลิปและทางลัด</DialogTitle>
        <div className="flex items-center gap-3 border-b border-grid px-4">
          <Search size={18} aria-hidden className="shrink-0 text-sub" />
          <input role="combobox" aria-label="ค้นหาคลิป" aria-expanded aria-autocomplete="list" aria-controls={listId}
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            placeholder="ค้นหาคลิป..." autoComplete="off" value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(-1) }} onKeyDown={onKey}
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-sub" />
          <kbd className={`shrink-0 ${KBD}`}>Esc</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {searching && (
            <Delayed>
              <div className="flex flex-col gap-2 px-1 pt-2"><Skeleton className="h-11" /><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
            </Delayed>
          )}
          <div role="listbox" id={listId} aria-label="ทางลัดและคลิป">
            {q ? (
              <>
                {hits.length > 0 && (
                  <div role="group" aria-label="คลิป">
                    <div aria-hidden className="px-3 pt-2 pb-1 text-xs text-sub">คลิป</div>
                    {hits.map((c, i) => {
                      const s = snippet([c.script, c.note, c.title].find((t) => t.toLowerCase().includes(deferred.toLowerCase())) ?? c.script, deferred, 28)
                      const d = fromIso(c.date)
                      return opt(i, `/clips/${c.id}`, <>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0"><CategoryBadge categoryId={c.category_id} /></span>
                            <b className="truncate font-bold">{c.title}</b>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-sub">{s.before}<mark className="bg-note-line text-ink">{s.match}</mark>{s.after}</p>
                        </div>
                        <span className="shrink-0 text-xs text-sub tabular-nums"><DateLabel date={d} variant="compact" /></span>
                      </>)
                    })}
                  </div>
                )}
                {empty && <p role="presentation" className="px-3 py-6 text-center text-sm text-sub">ไม่พบคลิปที่ตรงกับ “{deferred}”</p>}
                {opt(hits.length, seeAll, <>
                  <Search size={16} aria-hidden className="shrink-0 text-sub" />
                  <span className="text-sm">ดูผลทั้งหมด “{q}”</span>
                </>)}
              </>
            ) : (
              <div role="group" aria-label="ลัดไปที่">
                <div aria-hidden className="px-3 pt-2 pb-1 text-xs text-sub">ลัดไปที่</div>
                {shortcuts.map(({ to, label, icon: Icon }, i) => opt(i, to, <>
                  <Icon size={16} aria-hidden className="shrink-0 text-sub" />
                  <span className="text-sm">{label}</span>
                </>))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
