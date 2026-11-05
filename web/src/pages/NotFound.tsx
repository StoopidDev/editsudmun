import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="font-bold">ไม่พบหน้านี้</p>
      <Link to="/" className="text-sm text-brand">กลับหน้าแรก</Link>
    </div>
  )
}
