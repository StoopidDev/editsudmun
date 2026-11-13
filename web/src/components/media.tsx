import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { downloadAll } from '@/lib/viewer'

export function DownloadAll({ ids }: { ids: string[] }) {
  const [busy, setBusy] = useState(false)
  return (
    <Button variant="outline" size="sm" className="max-md:min-h-11" loading={busy} disabled={ids.length === 0}
      onClick={async () => {
        setBusy(true)
        try {
          const n = await downloadAll(ids)
          toast(`เริ่มดาวน์โหลด ${n} ไฟล์แล้ว`)
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'ดาวน์โหลดไม่สำเร็จ')
        } finally {
          setBusy(false)
        }
      }}>ดาวน์โหลดทั้งหมด</Button>
  )
}
