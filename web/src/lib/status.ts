import type { ClipStatus } from './types'

export const STATUS: Record<ClipStatus, { label: string; className: string }> = {
  todo: { label: 'รอทำ', className: 'bg-[#eeeeee] text-sub' },
  submitted: { label: 'ส่งแล้ว', className: 'bg-today text-[#0066cc]' },
  approved: { label: 'อนุมัติแล้ว', className: 'bg-[#e6f8ec] text-[#1a7f3c]' },
  revision: { label: 'รอแก้ไข', className: 'bg-[#fff0e0] text-[#b35c00]' },
}
