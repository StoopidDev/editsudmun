import { useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { DateLabel } from '@/components/DateLabel'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fromIso, fullDate, isIsoDate, toIso, todayIso } from '@/lib/dates'

// A date button that opens a calendar. The calendar opens under the point that was clicked (the button is wide), or under the button's left edge when opened by keyboard.
export function DateField({ id, value, onChange }: { id: string; value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const clickX = useRef<number | null>(null)
  const [byPointer, setByPointer] = useState(false)
  const valid = isIsoDate(value)
  const pick = (iso: string) => { onChange(iso); setOpen(false) }
  // A zero-width anchor at the click point; the popover centres on it and grows from it.
  const anchor = {
    getBoundingClientRect: () => {
      const r = trigger.current?.getBoundingClientRect() ?? new DOMRect()
      return clickX.current === null ? r : new DOMRect(clickX.current, r.y, 0, r.height)
    },
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger ref={trigger} id={id} aria-label={`วัน ${valid ? fullDate(fromIso(value)) : ''}`}
        onPointerDown={(e) => { clickX.current = e.clientX; setByPointer(true) }} onKeyDown={() => { clickX.current = null; setByPointer(false) }}
        className="flex h-9 w-full items-center justify-between rounded-md border border-line bg-bg px-2.5 text-left text-sm font-normal hover-pointer:bg-surface max-md:h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50">
        {valid && <DateLabel date={value} />}
        <CalendarDays size={16} aria-hidden className="text-sub" />
      </PopoverTrigger>
      <PopoverContent anchor={anchor} align={byPointer ? 'center' : 'start'} aria-label="เลือกวัน" className="w-auto duration-150">
        <Calendar mode="single" required autoFocus selected={valid ? fromIso(value) : undefined} defaultMonth={valid ? fromIso(value) : undefined}
          onSelect={(d) => pick(toIso(d))} />
        <Button variant="outline" size="sm" className="self-start" onClick={() => pick(todayIso())}>วันนี้</Button>
      </PopoverContent>
    </Popover>
  )
}
