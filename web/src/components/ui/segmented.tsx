// Two or more mutually exclusive options. A brand thumb slides to the chosen one; the unchosen options sit on a visible track, so each reads as a button.
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  const n = options.length
  const i = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div role="group" aria-label={label} className="relative grid rounded-card border border-line bg-surface p-0.5" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
      <span aria-hidden className="absolute inset-y-0.5 left-0.5 rounded-[calc(var(--radius-card)-3px)] bg-brand transition-transform duration-240 ease-(--ease-out-quint)"
        style={{ width: `calc((100% - 4px) / ${n})`, transform: `translateX(${i * 100}%)` }} />
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)}
            className={`press relative z-10 rounded-[calc(var(--radius-card)-3px)] px-3 py-1 text-sm font-medium transition-colors duration-200 max-md:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${on ? 'text-white' : 'text-ink hover-pointer:bg-ink/5'}`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
