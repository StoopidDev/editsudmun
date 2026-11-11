import type { ClipStatus } from './types'

export const STATUS: Record<ClipStatus, { label: string; className: string }> = {
  todo: { label: 'รอทำ', className: 'bg-chip text-sub' },
  submitted: { label: 'ส่งแล้ว', className: 'bg-today text-brand-text' },
  approved: { label: 'อนุมัติแล้ว', className: 'bg-ok-bg text-success-text' },
  revision: { label: 'รอแก้ไข', className: 'bg-warn-bg text-warn-text' },
}
