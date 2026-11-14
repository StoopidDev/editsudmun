import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export function NotFound() {
  return (
    <div className="enter py-16 text-center">
      <p className="font-bold">ไม่พบหน้านี้</p>
      <Link viewTransition to="/" className="link-action text-sm">กลับหน้าแรก<ChevronRight size={14} aria-hidden /></Link>
    </div>
  )
}
