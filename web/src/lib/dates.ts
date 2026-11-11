import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isValid, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { th } from 'date-fns/locale'

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์']
const opts = { weekStartsOn: 1 } as const

export const toIso = (d: Date) => format(d, 'yyyy-MM-dd')
export const fromIso = (s: string) => parseISO(s)
export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parseISO(s))
export const todayIso = () => toIso(new Date())
export const weekStart = (d: Date) => startOfWeek(d, opts)
export const weekDays = (d: Date) => eachDayOfInterval({ start: weekStart(d), end: addDays(weekStart(d), 6) })
export const monthGrid = (d: Date) =>
  eachDayOfInterval({ start: weekStart(startOfMonth(d)), end: endOfWeek(endOfMonth(d), opts) })
export const dayLabel = (d: Date) => DAYS[(d.getDay() + 6) % 7]
export const shortDate = (d: Date) => format(d, 'd MMM', { locale: th })
export const fullDate = (d: Date) => `${dayLabel(d)} ${format(d, 'd MMM yyyy', { locale: th })}`
export const monthLabel = (d: Date) => format(d, 'MMMM yyyy', { locale: th })
export const rangeLabel = (d: Date) => {
  const [a, b] = [weekStart(d), addDays(weekStart(d), 6)]
  return `${shortDate(a)} – ${shortDate(b)} ${format(b, 'yyyy')}`
}
export const sentAt = (iso: string) => format(parseISO(iso), 'd MMM HH:mm', { locale: th })
