import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

// 'default' is the first entry in this tab: a direct link has nothing to go back to.
export function BackButton({ fallback }: { fallback: string }) {
  const nav = useNavigate()
  const { key } = useLocation()
  return (
    <Button variant="outline" className="max-md:min-h-11" onClick={() => (key === 'default' ? nav(fallback) : nav(-1))}>
      <ChevronLeft />กลับ
    </Button>
  )
}
