import { dayLabel, fromIso, monthShort, relativeDay, toIso, yearIfOther } from '@/lib/dates'

// One way to show a date. The day number carries the weight; weekday, month and year step back in grey.
//  tile    weekday / big day / month (headers, empty cells)
//  inline  "วันนี้ เสาร์ 14 พ.ย." or "เสาร์ 14 พ.ย." (default; relative word first when the date is yesterday, today or tomorrow)
//  compact "14 พ.ย." for chips, rows and tables
export function DateLabel({ date, variant = 'inline', relative = true, className = '' }: { date: Date | string; variant?: 'tile' | 'inline' | 'compact'; relative?: boolean; className?: string }) {
  const d = typeof date === 'string' ? fromIso(date) : date
  const year = yearIfOther(d)
  const sub = 'font-normal text-sub'
  const day = <b className="font-bold text-ink tabular-nums">{d.getDate()}</b>

  let body
  if (variant === 'tile') {
    body = (
      <span className="inline-flex flex-col items-center leading-tight">
        <span className={`text-xs ${sub}`}>{dayLabel(d)}</span>
        <b className="text-2xl font-bold text-ink tabular-nums">{d.getDate()}</b>
        <span className={`text-xs ${sub}`}>{monthShort(d)}{year}</span>
      </span>
    )
  } else if (variant === 'compact') {
    body = <span>{day} <span className={sub}>{monthShort(d)}{year}</span></span>
  } else {
    const rel = relative ? relativeDay(d) : null
    body = rel
      ? <span><b className="font-bold text-ink">{rel}</b> <span className={sub}>{dayLabel(d)} {d.getDate()} {monthShort(d)}{year}</span></span>
      : <span><span className={sub}>{dayLabel(d)}</span> {day} <span className={sub}>{monthShort(d)}{year}</span></span>
  }
  return <time dateTime={toIso(d)} className={className}>{body}</time>
}
