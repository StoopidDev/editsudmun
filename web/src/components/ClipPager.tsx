import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useClips } from '@/api/queries'
import { Button } from '@/components/ui/button'

export function ClipPager({ clipId, date }: { clipId: string; date: string }) {
  const nav = useNavigate()
  const { data: day = [] } = useClips(date, date)
  const i = day.findIndex((c) => c.id === clipId)
  // replace: paging through a day must not fill the history, so Back returns to the list.
  const go = (id: string) => nav(`/clips/${id}`, { replace: true, viewTransition: true })
  return (
    <div className="flex items-center gap-2 text-xs text-sub">
      {i >= 0 && <span>คลิป {i + 1} จาก {day.length} ของวันนั้น</span>}
      <Button variant="outline" size="icon" className="min-h-11 min-w-11 md:min-h-0 md:min-w-0" aria-label="คลิปก่อนหน้า" disabled={i <= 0} onClick={() => go(day[i - 1].id)}><ChevronLeft /></Button>
      <Button variant="outline" size="icon" className="min-h-11 min-w-11 md:min-h-0 md:min-w-0" aria-label="คลิปถัดไป" disabled={i < 0 || i >= day.length - 1} onClick={() => go(day[i + 1].id)}><ChevronRight /></Button>
    </div>
  )
}
