import { Link } from 'react-router-dom'
import { FileText, Image as ImageIcon } from 'lucide-react'
import { CategoryBadge, StatusChip } from '@/components/bits'
import { shareTitle } from '@/lib/viewTransition'
import type { ClipCardRow } from '@/lib/types'

// variant "today" (Home) shows the position in the day and always the two-line script.
export function ClipCard({ clip, variant, index, total }: { clip: ClipCardRow; variant?: 'today'; index?: number; total?: number }) {
  const today = variant === 'today'
  return (
    <Link viewTransition to={`/clips/${clip.id}`} onClick={(e) => shareTitle(e, clip.id)} className={`flex min-w-0 flex-col gap-1 overflow-hidden rounded-card border border-line bg-bg press hover-tint hover-pointer:border-ink/40 ${today ? 'p-3' : 'p-2'}`}>
      <div className="flex flex-wrap items-center gap-1">
        <CategoryBadge categoryId={clip.category_id} />
        <StatusChip status={clip.status} />
        {today && index !== undefined && total !== undefined && <span className="ml-auto text-xs text-sub">คลิป {index} จาก {total}</span>}
      </div>
      <b data-title className="text-sm">{clip.title}</b>
      <p className={`line-clamp-2 text-sm text-sub ${today ? '' : 'xl:hidden'}`}>{clip.script_preview}</p>
      <div className="flex gap-2 text-xs text-sub">
        {clip.imageCount > 0 && <span className="flex items-center gap-1"><ImageIcon size={12} />{clip.imageCount}</span>}
        {clip.has_note && <span className="flex items-center gap-1"><FileText size={12} />หมายเหตุ</span>}
      </div>
    </Link>
  )
}
