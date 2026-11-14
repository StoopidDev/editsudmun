import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Shown when a route or its page chunk fails to load or render.
export function RouteError() {
  return (
    <div role="alert" className="enter flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6 text-center text-ink">
      <p className="text-base">เกิดข้อผิดพลาด</p>
      <Button type="button" className="min-h-11" onClick={() => location.reload()}>
        <RotateCw />โหลดใหม่
      </Button>
    </div>
  )
}
