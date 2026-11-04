import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Calendar, Globe, Home, LogOut, Menu, Moon, Search, Tag, User, Users } from 'lucide-react'
import * as api from '@/api/index'
import { useMe } from '@/api/queries'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

const NAV = [
  { to: '/', label: 'หน้าแรก', icon: Home, owner: false },
  { to: '/calendar', label: 'ปฏิทิน', icon: Calendar, owner: false },
  { to: '/categories', label: 'ประเภทคลิป', icon: Tag, owner: true },
  { to: '/users', label: 'ผู้ใช้งาน', icon: Users, owner: true },
]

const TITLES: [string, string][] = [
  ['/calendar', 'ปฏิทิน'], ['/clips/new', 'เพิ่มคลิป'], ['/clips', 'รายละเอียดคลิป'],
  ['/categories', 'ประเภทคลิป'], ['/users', 'ผู้ใช้งาน'], ['/search', 'ค้นหา'],
]

function Sidebar({ rail, onNavigate }: { rail?: boolean; onNavigate?: () => void }) {
  const { data: me } = useMe()
  const qc = useQueryClient()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q')?.toString().trim()
    if (q) { nav(`/search?q=${encodeURIComponent(q)}`); onNavigate?.() }
  }

  const logout = () => {
    api.logout()
    qc.clear()
    nav('/login')
  }

  return (
    <div className="flex h-full flex-col gap-4 bg-surface p-3">
      {!rail && <Link to="/" className="px-2 py-2 text-lg">Channel's Tool</Link>}
      {rail ? (
        <Link to="/search" aria-label="ค้นหา" className="flex justify-center p-2"><Search size={18} /></Link>
      ) : (
        <form onSubmit={submit} className="flex items-center gap-2 rounded-card border border-line bg-[#e6e6e6] px-2 py-1.5">
          <Search size={16} />
          <input ref={input} name="q" defaultValue={params.get('q') ?? ''} placeholder="ค้นหาคลิป..." aria-label="ค้นหาคลิป" className="w-full bg-transparent text-sm outline-none" />
          <kbd className="hidden rounded bg-white px-1 text-xs text-sub lg:inline">Ctrl K</kbd>
        </form>
      )}
      <nav className="flex flex-col gap-1">
        {NAV.filter((n) => !n.owner || me?.role === 'owner').map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} aria-label={label}
            className={({ isActive }) => `flex items-center gap-2 rounded-card px-2 py-2 text-sm ${rail ? 'justify-center' : ''} ${isActive ? 'bg-brand text-white' : ''}`}>
            <Icon size={16} />{!rail && label}
          </NavLink>
        ))}
      </nav>
      <div className={`mt-auto flex items-center gap-2 px-2 ${rail ? 'flex-col' : ''}`}>
        <span className="flex size-8 items-center justify-center rounded-full bg-ink text-white"><User size={16} /></span>
        {rail && <button onClick={logout} aria-label="ออกจากระบบ" className="flex size-8 items-center justify-center text-sub"><LogOut size={16} /></button>}
        {!rail && (
          <div className="text-sm">
            <b>{me?.display_name}</b>
            <div className="text-xs text-sub">{me?.role === 'owner' ? 'เจ้าของ' : 'ครีเอเตอร์'}</div>
            <button onClick={logout} className="text-xs text-sub underline">ออกจากระบบ</button>
          </div>
        )}
      </div>
    </div>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const title = TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? 'หน้าแรก'
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 lg:block"><Sidebar /></aside>
      <aside className="sticky top-0 hidden h-dvh w-16 shrink-0 md:block lg:hidden"><Sidebar rail /></aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">เมนู</SheetTitle>
          <Sidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2">
            <button className="md:hidden" aria-label="เปิดเมนู" onClick={() => setOpen(true)}><Menu /></button>
            <span className="text-lg">{title}</span>
          </div>
          <div className="flex gap-3 text-sub">
            <button disabled aria-label="ภาษา (ยังไม่เปิดใช้)"><Globe size={18} /></button>
            <button disabled aria-label="โหมดมืด (ยังไม่เปิดใช้)"><Moon size={18} /></button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6"><Outlet /></main>
      </div>
    </div>
  )
}
