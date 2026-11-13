import { useContext, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Calendar, Home, KeyRound, LogOut, Menu, Moon, PanelLeft, Search, Sun, Tag, User, Users } from 'lucide-react'
import * as api from '@/api/index'
import { useMe } from '@/api/queries'
import { ConfirmDialog } from '@/components/bits'
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog'
import { CommandPalette } from '@/components/CommandPalette'
import { Button } from '@/components/ui/button'
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
  const name = dark ? 'โหมดสว่าง' : 'โหมดมืด'
  // Both icons stay mounted and crossfade (opacity, scale, blur) so the swap reads as one change, not a pop.
  const icon = (on: boolean) => `absolute inset-0 transition-[opacity,scale,filter] duration-200 ease-out ${on ? 'opacity-100 scale-100 blur-[0px]' : 'opacity-0 scale-75 blur-[4px]'}`
  return (
    <button type="button" onClick={toggleTheme} aria-label={name} title={name}
      className={`press hover-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand flex h-8 min-w-8 max-md:min-h-11 items-center justify-center gap-2 rounded-card px-2 text-sub ${className}`}>
      <span aria-hidden className="relative size-[18px] shrink-0">
        <Sun size={18} className={icon(dark)} />
        <Moon size={18} className={icon(!dark)} />
      </span>
      {label && <span className="text-sm font-normal">{name}</span>}
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
  const [changing, setChanging] = useState(false)
  // Clicking the search field opens the full search page; the palette opens from the keyboard shortcut only.
  const openSearch = () => { nav('/search', { viewTransition: true }); onNavigate?.() }
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const { pathname } = useLocation()
  const items = NAV.filter((n) => !n.owner || me?.role === 'owner')
  const active = items.findIndex((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))

  const hub = useContext(Ctx)
  const logout = async () => {
    // Stop uploads before the session ends, or they keep sending with no session.
    hub?.cancelAll()
    await api.logout()
    qc.clear()
    nav('/login', { viewTransition: true })
  }

  return (
    <div className={`flex h-full flex-col gap-4 bg-surface p-3 ${rail ? '' : 'min-w-60'}`}>
      <div className={`flex items-center ${rail ? 'flex-col' : 'justify-between'}`}>
        {!rail && (
          <Link viewTransition to="/" aria-label="กลับสู่หน้าหลัก" title="กลับสู่หน้าหลัก"
            className="group relative block overflow-hidden rounded-card px-2 py-2 text-xl font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            {/* Title slides out to the left, the hint slides in from the right; both reverse on leave. Pointer devices and keyboard focus only. */}
            <span className="block transition-transform duration-[260ms] ease-(--ease-drawer) group-focus-visible:-translate-x-full hover-pointer:group-hover:-translate-x-full">Channel's Tool</span>
            <span aria-hidden className="absolute inset-0 flex translate-x-full items-center px-2 text-base whitespace-nowrap text-brand-text transition-transform duration-[260ms] ease-(--ease-drawer) group-focus-visible:translate-x-0 hover-pointer:group-hover:translate-x-0">กลับสู่หน้าหลัก</span>
          </Link>
        )}
        {onToggle && (
          <button type="button" onClick={onToggle} aria-label={rail ? 'แสดงเมนู' : 'ซ่อนเมนู'} aria-expanded={!rail}
            className="hover-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand hidden size-8 items-center justify-center rounded-card text-sub lg:flex"><PanelLeft size={18} /></button>
        )}
      </div>
      {rail ? (
        <button type="button" onClick={openSearch} aria-label="ค้นหา" className="flex justify-center rounded-card p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"><Search size={18} /></button>
      ) : (
        <button type="button" onClick={openSearch} className="press hover-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand flex w-full items-center gap-2 rounded-card border border-line bg-bg px-2 py-1.5 text-left text-sm text-sub">
          <Search size={16} aria-hidden />
          <span className="min-w-0 flex-1 truncate">ค้นหาคลิป...</span>
          <kbd className="hidden shrink-0 rounded bg-bg px-1 text-xs whitespace-nowrap text-sub lg:inline">Ctrl K</kbd>
        </button>
      )}
      <nav className="relative flex flex-col gap-1">
        {/* One brand thumb slides to the active item (same idea as Segmented); it hides on pages that are not in the list, e.g. a clip. */}
        <span aria-hidden className="absolute top-0 left-0 h-10 w-full rounded-card bg-brand transition-[transform,opacity] duration-[260ms] ease-(--ease-drawer)"
          style={{ transform: `translateY(calc(${Math.max(active, 0)} * 2.75rem))`, opacity: active < 0 ? 0 : 1 }} />
        {items.map(({ to, label, icon: Icon }, i) => (
          <NavLink viewTransition key={to} to={to} end={to === '/'} onClick={onNavigate} aria-label={label}
            className={`press hover-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand relative z-10 flex h-10 items-center gap-2 rounded-card px-2 text-base font-normal transition-colors duration-200 ${rail ? 'justify-center' : ''} ${i === active ? 'text-white' : ''}`}>
            <Icon size={16} />{!rail && label}
          </NavLink>
        ))}
      </nav>
      {onNavigate && <ThemeButton label className="w-full justify-start" />}
      {rail ? (
        <div className="mt-auto flex items-center gap-2 px-2 flex-col">
          <ThemeButton />
          <span className="flex size-[35px] items-center justify-center rounded-full bg-avatar text-white"><User size={16} /></span>
          <button onClick={() => setChanging(true)} aria-label="เปลี่ยนรหัสผ่าน" className="flex size-8 items-center justify-center rounded-card text-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"><KeyRound size={16} /></button>
          <button onClick={() => setConfirmingLogout(true)} aria-label="ออกจากระบบ" className="flex size-8 items-center justify-center rounded-card text-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"><LogOut size={16} /></button>
        </div>
      ) : (
        <div className="mt-auto flex flex-col gap-1 border-t border-grid pt-3">
          <div className="flex items-center gap-3 px-2 pb-1">
            <span className="flex size-[35px] shrink-0 items-center justify-center rounded-full bg-avatar text-white"><User size={16} /></span>
            <div className="min-w-0 text-sm">
              <b className="block truncate">{me?.display_name}</b>
              <div className="text-xs text-sub">{me?.role === 'owner' ? 'เจ้าของ' : 'ครีเอเตอร์'}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sub" onClick={() => setChanging(true)}><KeyRound />เปลี่ยนรหัสผ่าน</Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sub" onClick={() => setConfirmingLogout(true)}><LogOut />ออกจากระบบ</Button>
        </div>
      )}
      {changing && <ChangePasswordDialog onClose={() => setChanging(false)} />}
      <ConfirmDialog open={confirmingLogout} title="ออกจากระบบ?" tone="neutral" confirm="ออกจากระบบ"
        body={<>คุณจะต้องเข้าสู่ระบบอีกครั้งเพื่อใช้งานต่อ{hub?.unfinished() && ' ยังอัปโหลดไม่เสร็จ ไฟล์ที่ค้างอยู่จะหยุด'}</>}
        onConfirm={logout} onClose={() => setConfirmingLogout(false)} />
    </div>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  // From lg the full sidebar is the default; collapsing it shows the 64 px rail. Below lg the rail is always shown.
  const wide = useMediaQuery('(min-width: 1024px)')
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [palette, setPalette] = useState(false)
  const rail = !wide || collapsed
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch { /* blocked storage: keep the state for this visit */ }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const title = pathname === '/' ? 'หน้าแรก' : TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? 'ไม่พบหน้า'
  return (
    <UploadProvider>
      <CommandPalette open={palette} onOpenChange={setPalette} />
      <div className="flex min-h-dvh">
        <aside style={{ viewTransitionName: 'sidebar' }} className={`sticky top-0 hidden h-dvh shrink-0 overflow-hidden transition-[width] duration-[240ms] ease-(--ease-out-quint) md:block ${rail ? 'w-16' : 'w-60'}`}>
          <Sidebar rail={rail} onToggle={toggle} />
        </aside>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">เมนู</SheetTitle>
            <Sidebar onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col">
          <header style={{ viewTransitionName: 'topbar' }} className="relative z-10 flex h-16 items-center border-b border-line bg-bg px-4">
            <div className="flex items-center gap-2">
              <button className="flex min-h-11 min-w-11 items-center justify-center rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:hidden" aria-label="เปิดเมนู" onClick={() => setOpen(true)}><Menu /></button>
              <span className="text-xl font-normal">{title}</span>
            </div>
            <div className="ml-auto hidden lg:block"><ThemeButton /></div>
          </header>
          <main style={{ viewTransitionName: 'page' }} className="flex-1 bg-bg p-4 pb-24 md:p-6 md:pb-6"><Outlet /></main>
        </div>
        <nav aria-label="เมนูหลัก" style={{ viewTransitionName: 'tabbar' }} className="fixed inset-x-0 bottom-0 z-20 flex h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink viewTransition key={to} to={to} end={to === '/'}
              className={({ isActive }) => `press relative flex flex-1 flex-col items-center justify-center gap-0.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${isActive ? 'font-bold text-brand' : 'text-sub'}`}>
              {({ isActive }) => (
                <>
                  <span aria-hidden className={`absolute inset-x-4 top-0 h-0.5 origin-center rounded-full bg-brand transition-transform duration-200 ${isActive ? 'scale-x-100' : 'scale-x-0'}`} />
                  <Icon size={20} />{label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </UploadProvider>
  )
}
