import { Link } from 'react-router-dom'
import { FileText, Image as ImageIcon } from 'lucide-react'
import { CategoryBadge, StatusChip } from '@/components/bits'
import type { ClipCardRow } from '@/lib/types'

export function ClipCard({ clip }: { clip: ClipCardRow }) {
  return (
    <Link to={`/clips/${clip.id}`} className="flex flex-col gap-1 rounded-card border border-line bg-white p-2 hover:bg-surface">
      <div className="flex flex-wrap items-center gap-1">
        <CategoryBadge categoryId={clip.category_id} />
        <StatusChip status={clip.status} />
      </div>
      <b className="text-sm">{clip.title}</b>
      <div className="flex gap-2 text-xs text-sub">
        {clip.imageCount > 0 && <span className="flex items-center gap-1"><ImageIcon size={12} />{clip.imageCount}</span>}
        {clip.note && <span className="flex items-center gap-1"><FileText size={12} />หมายเหตุ</span>}
      </div>
    </Link>
  )
}
