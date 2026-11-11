import { useContext, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Calendar, Home, KeyRound, LogOut, Menu, Moon, PanelLeft, Search, Sun, Tag, User, Users } from 'lucide-react'
import * as api from '@/api/index'
import { useMe } from '@/api/queries'
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { toggleTheme, useTheme } from '@/lib/theme'
import { Ctx } from '@/lib/upload-state'
import { UploadProvider } from '@/lib/uploads'
import { useMediaQuery } from '@/lib/useMediaQuery'

const NAV = [
  { to: '/', label: 'หน้าแรก', icon: Home, owner: false },
  { to: '/calendar', label: 'ปฏิทิน', icon: Calendar, owner: false },
  { to: '/categories', label: 'ประเภทคลิป', icon: Tag, owner: true },
  { to: '/users', label: 'ผู้ใช้งาน', icon: Users, owner: true },
]

const TABS = [
  { to: '/', label: 'หน้าแรก', icon: Home },
  { to: '/calendar', label: 'ปฏิทิน', icon: Calendar },
  { to: '/search', label: 'ค้นหา', icon: Search },
]

const TITLES: [string, string][] = [
  ['/calendar', 'ปฏิทิน'], ['/clips/new', 'เพิ่มคลิป'], ['/clips', 'รายละเอียดคลิป'],
  ['/categories', 'ประเภทคลิป'], ['/users', 'ผู้ใช้งาน'], ['/search', 'ค้นหา'],
]

// Header, rail and menu sheet share one toggle: the icon shows the theme it switches to.
function ThemeButton({ className = '', label }: { className?: string; label?: boolean }) {
  const dark = useTheme()
  const Icon = dark ? Sun : Moon
  const name = dark ? 'โหมดสว่าง' : 'โหมดมืด'
  return (
    <button type="button" onClick={toggleTheme} aria-label={name} title={name}
      className={`press hover-tint flex h-8 min-w-8 max-md:min-h-11 items-center justify-center gap-2 rounded-card px-2 text-sub ${className}`}>
      <Icon size={18} />{label && <span className="text-sm font-light">{name}</span>}
    </button>
  )
}

const COLLAPSE_KEY = 'sidebar-collapsed'
// Storage can be blocked (private mode): the sidebar then starts expanded and the choice lasts one visit.
function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
}

function Sidebar({ rail, onNavigate, onToggle }: { rail?: boolean; onNavigate?: () => void; onToggle?: () => void }) {
  const { data: me } = useMe()
  const qc = useQueryClient()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const input = useRef<HTMLInputElement>(null)
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q')?.toString().trim()
    if (q) { nav(`/search?q=${encodeURIComponent(q)}`, { viewTransition: true }); onNavigate?.() }
  }

  const uppy = useContext(Ctx)
  const logout = async () => {
    if (uppy?.getFiles().some((f) => !f.progress.complete && !f.error) && !window.confirm('ยังอัปโหลดไม่เสร็จ ออกจากระบบเลยไหม')) return
    await api.logout()
    qc.clear()
    nav('/login', { viewTransition: true })
  }

  return (
    <div className={`flex h-full flex-col gap-4 bg-surface p-3 ${rail ? '' : 'min-w-60'}`}>
      <div className={`flex items-center ${rail ? 'flex-col' : 'justify-between'}`}>
        {!rail && <Link viewTransition to="/" className="px-2 py-2 text-xl font-light">Channel's Tool</Link>}
        {onToggle && (
          <button type="button" onClick={onToggle} aria-label={rail ? 'แสดงเมนู' : 'ซ่อนเมนู'} aria-expanded={!rail}
            className="hover-tint hidden size-8 items-center justify-center rounded-card text-sub lg:flex"><PanelLeft size={18} /></button>
        )}
      </div>
      {rail ? (
        <Link viewTransition to="/search" aria-label="ค้นหา" className="flex justify-center p-2"><Search size={18} /></Link>
      ) : (
        <form onSubmit={submit} className="flex items-center gap-2 rounded-card border border-line bg-grid px-2 py-1.5">
          <Search size={16} />
          <input ref={input} name="q" defaultValue={params.get('q') ?? ''} placeholder="ค้นหาคลิป..." aria-label="ค้นหาคลิป" className="w-full bg-transparent text-sm outline-none" />
          <kbd className="hidden rounded bg-bg px-1 text-xs text-sub lg:inline">Ctrl K</kbd>
        </form>
      )}
      <nav className="flex flex-col gap-1">
        {NAV.filter((n) => !n.owner || me?.role === 'owner').map(({ to, label, icon: Icon }) => (
          <NavLink viewTransition key={to} to={to} end={to === '/'} onClick={onNavigate} aria-label={label}
            className={({ isActive }) => `press hover-tint flex items-center gap-2 rounded-card px-2 py-2 text-base font-light ${rail ? 'justify-center' : ''} ${isActive ? 'bg-brand text-white' : ''}`}>
            <Icon size={16} />{!rail && label}
          </NavLink>
        ))}
      </nav>
      {onNavigate && <ThemeButton label className="w-full justify-start" />}
      <div className={`mt-auto flex items-center gap-2 px-2 ${rail ? 'flex-col' : ''}`}>
        {rail && <ThemeButton />}
        <span className="flex size-[35px] items-center justify-center rounded-full bg-avatar text-white"><User size={16} /></span>
        {rail && <button onClick={() => setChanging(true)} aria-label="เปลี่ยนรหัสผ่าน" className="flex size-8 items-center justify-center text-sub"><KeyRound size={16} /></button>}
        {rail && <button onClick={logout} aria-label="ออกจากระบบ" className="flex size-8 items-center justify-center text-sub"><LogOut size={16} /></button>}
        {!rail && (
          <div className="text-sm">
            <b>{me?.display_name}</b>
            <div className="text-xs text-sub">{me?.role === 'owner' ? 'เจ้าของ' : 'ครีเอเตอร์'}</div>
            <button onClick={() => setChanging(true)} className="block text-xs text-sub underline hover-pointer:no-underline">เปลี่ยนรหัสผ่าน</button>
            <button onClick={logout} className="text-xs text-sub underline">ออกจากระบบ</button>
          </div>
        )}
      </div>
      {changing && <ChangePasswordDialog onClose={() => setChanging(false)} />}
    </div>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  // From lg the full sidebar is the default; collapsing it shows the 64 px rail. Below lg the rail is always shown.
  const wide = useMediaQuery('(min-width: 1024px)')
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const rail = !wide || collapsed
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch { /* blocked storage: keep the state for this visit */ }
  }
  const title = pathname === '/' ? 'หน้าแรก' : TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? 'ไม่พบหน้า'
  return (
    <UploadProvider>
      <div className="flex min-h-dvh">
        <aside className={`sticky top-0 hidden h-dvh shrink-0 overflow-hidden transition-[width] duration-[240ms] ease-(--ease-out-quint) md:block ${rail ? 'w-16' : 'w-60'}`}>
          <Sidebar rail={rail} onToggle={toggle} />
        </aside>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">เมนู</SheetTitle>
            <Sidebar onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center border-b border-line px-4">
            <div className="flex items-center gap-2">
              <button className="flex min-h-11 min-w-11 items-center justify-center md:hidden" aria-label="เปิดเมนู" onClick={() => setOpen(true)}><Menu /></button>
              <span className="text-xl font-light">{title}</span>
            </div>
            <div className="ml-auto hidden lg:block"><ThemeButton /></div>
          </header>
          <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6"><Outlet /></main>
        </div>
        <nav aria-label="เมนูหลัก" className="fixed inset-x-0 bottom-0 z-20 flex h-16 border-t border-line bg-bg md:hidden">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink viewTransition key={to} to={to} end={to === '/'}
              className={({ isActive }) => `press flex flex-1 flex-col items-center justify-center gap-0.5 text-xs ${isActive ? 'font-bold text-brand' : 'text-sub'}`}>
              <Icon size={20} />{label}
            </NavLink>
          ))}
        </nav>
      </div>
    </UploadProvider>
  )
}
