import { addDays, eachDayOfInterval, format, isValid, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { th } from 'date-fns/locale'

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์']
const opts = { weekStartsOn: 1 } as const

export const toIso = (d: Date) => format(d, 'yyyy-MM-dd')
export const fromIso = (s: string) => parseISO(s)
export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parseISO(s))
export const todayIso = () => toIso(new Date())
export const weekStart = (d: Date) => startOfWeek(d, opts)
export const weekDays = (d: Date) => eachDayOfInterval({ start: weekStart(d), end: addDays(weekStart(d), 6) })
// Always 6 weeks (42 cells), so the month grid keeps one size; the spare cells show the neighbouring months.
export const monthGrid = (d: Date) => {
  const start = weekStart(startOfMonth(d))
  return eachDayOfInterval({ start, end: addDays(start, 41) })
}

// The view the user last used (week or month), so leaving the calendar and coming back does not reset it.
const VIEW_KEY = 'calendar-view'
const storedView = () => { try { return localStorage.getItem(VIEW_KEY) === 'month' ? 'month' : 'week' } catch { return 'week' } }
export const rememberView = (v: string) => { try { localStorage.setItem(VIEW_KEY, v) } catch { /* per-browser convenience only */ } }
export const dayLabel = (d: Date) => DAYS[(d.getDay() + 6) % 7]
export const shortDate = (d: Date) => format(d, 'd MMM', { locale: th })
export const fullDate = (d: Date) => `${dayLabel(d)} ${format(d, 'd MMM yyyy', { locale: th })}`
export const monthLabel = (d: Date) => format(d, 'MMMM yyyy', { locale: th })
export const rangeLabel = (d: Date) => {
  const [a, b] = [weekStart(d), addDays(weekStart(d), 6)]
  return `${shortDate(a)} – ${shortDate(b)} ${format(b, 'yyyy')}`
}
export const sentAt = (iso: string) => format(parseISO(iso), 'd MMM HH:mm', { locale: th })

// The calendar's view and its days, from the URL (?view=month, ?date=yyyy-MM-dd). A missing or bad date means today.
export function calendarView(params: URLSearchParams) {
  const raw = params.get('view')
  const view = raw === 'month' || raw === 'week' ? raw : storedView()
  const parsed = fromIso(params.get('date') ?? '')
  const date = isValid(parsed) ? parsed : fromIso(todayIso())
  return { view, date, days: view === 'week' ? weekDays(date) : monthGrid(date) }
}

// "วันนี้", "พรุ่งนี้" or "เมื่อวาน" when the date is that close, else null.
export const relativeDay = (d: Date) => {
  const diff = Math.round((fromIso(toIso(d)).getTime() - fromIso(todayIso()).getTime()) / 86_400_000)
  return diff === 0 ? 'วันนี้' : diff === 1 ? 'พรุ่งนี้' : diff === -1 ? 'เมื่อวาน' : null
}
export const monthShort = (d: Date) => format(d, 'MMM', { locale: th })
// The year is shown only when it is not the current one.
export const yearIfOther = (d: Date) => (d.getFullYear() === new Date().getFullYear() ? '' : ` ${format(d, 'yyyy')}`)
