import { DayPicker, type DayPickerProps } from 'react-day-picker'
import { th } from 'react-day-picker/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const nav = 'press hover-tint grid size-9 place-items-center rounded-md max-md:size-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

// react-day-picker with the app's tokens: Thai month and weekday names, weeks start Monday, always 6 rows so the popover keeps one size.
export function Calendar(props: DayPickerProps) {
  return (
    <DayPicker
      locale={th}
      weekStartsOn={1}
      showOutsideDays
      fixedWeeks
      classNames={{
        root: 'relative text-sm',
        month: 'flex flex-col gap-1',
        month_caption: 'flex h-9 items-center justify-center font-semibold tabular-nums max-md:h-11',
        nav: 'absolute inset-x-0 top-0 flex justify-between',
        button_previous: nav,
        button_next: nav,
        month_grid: 'border-collapse',
        weekday: 'size-9 text-xs font-normal text-sub max-md:w-11',
        day: 'p-0 text-center',
        day_button: 'press hover-tint size-9 rounded-md tabular-nums max-md:size-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        today: '[&>button]:font-bold [&>button]:ring-1 [&>button]:ring-brand [&>button]:ring-inset',
        selected: '[&>button]:bg-brand [&>button]:font-bold [&>button]:text-white',
        outside: 'text-sub',
        disabled: 'opacity-50',
      }}
      components={{ Chevron: ({ orientation }) => (orientation === 'left' ? <ChevronLeft size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />) }}
      {...props}
    />
  )
}
