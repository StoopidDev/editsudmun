import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Image as ImageIcon } from 'lucide-react'
import { CategoryBadge, StatusChip } from '@/components/bits'
import { shareTitle } from '@/lib/viewTransition'
import type { ClipCardRow } from '@/lib/types'

// variant "today" (Home) shows the position in the day and always the two-line script.
// enterIndex staggers the fade-in of a list (calendar lists only; Home does not pass it).
// square: 1:1 week-grid card (script hidden, title clamped to 3 lines, footer pinned to the bottom).
export function ClipCard({ clip, variant, index, total, enterIndex, square }: { clip: ClipCardRow; variant?: 'today'; index?: number; total?: number; enterIndex?: number; square?: boolean }) {
  const today = variant === 'today'
  const enter = enterIndex !== undefined
  const scriptCls = square ? 'hidden' : today ? '' : 'xl:hidden'
  return (
    <Link viewTransition to={`/clips/${clip.id}`} onClick={(e) => shareTitle(e, clip.id)} style={enter ? { '--i': enterIndex } as CSSProperties : undefined} className={`flex min-w-0 flex-col gap-1 overflow-hidden rounded-card border border-line bg-bg card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${today ? 'p-3' : 'p-2'} ${enter ? 'enter' : ''} ${square ? 'aspect-square' : ''}`}>
      <div className="flex flex-wrap items-center gap-1">
        <CategoryBadge categoryId={clip.category_id} />
        <StatusChip status={clip.status} />
        {today && index !== undefined && total !== undefined && <span className="ml-auto text-xs text-sub tabular-nums">คลิป {index} จาก {total}</span>}
      </div>
      <b data-title className={`text-sm ${square ? 'line-clamp-3' : ''}`}>{clip.title}</b>
      <p className={`line-clamp-2 text-sm text-sub ${scriptCls}`}>{clip.script_preview}</p>
      <div className={`flex gap-2 text-xs text-sub ${square ? 'mt-auto' : ''}`}>
        {clip.imageCount > 0 && <span className="flex items-center gap-1 tabular-nums"><ImageIcon size={12} />{clip.imageCount}</span>}
        {clip.has_note && <span className="flex items-center gap-1"><FileText size={12} />หมายเหตุ</span>}
      </div>
    </Link>
  )
}
