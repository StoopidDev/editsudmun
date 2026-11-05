import type { Clip, Role } from './types'

export type Attention = 'revision' | 'overdue' | 'review'

export const ATTENTION_LABEL: Record<Attention, string> = {
  revision: 'รอแก้ไข',
  overdue: 'เลยกำหนด',
  review: 'รอตรวจ',
}

export function attentionOf(c: Pick<Clip, 'status' | 'date'>, role: Role, today: string): Attention | null {
  if (role === 'owner') return c.status === 'submitted' ? 'review' : null
  if (c.status === 'revision') return 'revision'
  return c.status === 'todo' && c.date < today ? 'overdue' : null
}
