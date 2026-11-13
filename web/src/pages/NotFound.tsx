import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="enter py-16 text-center">
      <p className="font-bold">ไม่พบหน้านี้</p>
      <Link viewTransition to="/" className="text-sm text-brand">กลับหน้าแรก</Link>
    </div>
  )
}
