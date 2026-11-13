import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// A section with nothing in it still says so: what is missing, and (optionally) what to do about it.
export function EmptyState({ icon: Icon, title, hint, children, className = '' }: { icon?: LucideIcon; title: string; hint?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 px-3 py-6 text-center ${className}`}>
      {Icon && <Icon size={20} aria-hidden className="mb-1 text-sub" />}
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-[40ch] text-xs text-sub">{hint}</p>}
      {children}
    </div>
  )
}
