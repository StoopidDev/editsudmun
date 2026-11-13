import { useContext, useEffect, useState, type CSSProperties } from 'react'
import { RollDir } from '@/lib/rollDir'

// Slot-machine swap for short text: when `value` changes the old text slides out sideways and the new text slides in, in 280 ms (out 240 ms).
export function Roll({ value, className = '' }: { value: string; className?: string }) {
  const dir = useContext(RollDir)
  const [shown, setShown] = useState(value)
  const [out, setOut] = useState<string | null>(null)
  if (shown !== value) { setOut(shown); setShown(value) } // adjust state while rendering: the old text is kept for the exit
  useEffect(() => {
    if (out === null) return
    const t = window.setTimeout(() => setOut(null), 300)
    return () => window.clearTimeout(t)
  }, [out])
  return (
    <span className={`relative inline-block overflow-hidden align-bottom ${className}`} style={{ '--rd': dir } as CSSProperties}>
      <span key={shown} className={`inline-block ${out === null ? '' : 'roll-in'}`}>{shown}</span>
      {out !== null && <span aria-hidden className="roll-out absolute inset-0 inline-block">{out}</span>}
    </span>
  )
}
