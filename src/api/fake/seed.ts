import { addDays, subDays, subMinutes } from 'date-fns'
import { toIso, weekStart } from '@/lib/dates'
import type { Category, Clip, ClipMedia, Profile } from '@/lib/types'

export interface DB {
  profiles: Profile[]
  passwords: Record<string, string>
  categories: Category[]
  clips: Clip[]
  media: ClipMedia[]
}

const SCRIPT = `สวัสดีครับทุกคน วันนี้เรามารีวิว Tissot PRX 40 มม. กันครับ นาฬิกาที่หลายคนบอกว่าคุ้มที่สุดในงบไม่เกินสามหมื่นบาท

เริ่มจากตัวเรือน สแตนเลสสตีลขัดเงาสลับด้าน ดีไซน์ได้แรงบันดาลใจจากยุคเจ็ดศูนย์ สายเป็นแบบ integrated ที่ใส่แล้วกระชับข้อมือมาก

ปิดท้ายด้วยข้อสรุปว่านาฬิกาเรือนนี้เหมาะกับใคร และราคาที่ควรซื้อเมื่อเทียบกับคู่แข่งในระดับเดียวกัน`

const NOTE = 'ห้ามใช้เพลงที่ใช้ในคลิป Seiko\nพูดให้เร็วขึ้นตอนบอกสเปก\nใส่ภาพ close-up หน้าปัดตอนพูดถึงสีน้ำเงิน'

export function seed(): DB {
  const now = new Date()
  const today = toIso(now)
  const mon = weekStart(now)
  const day = (n: number) => toIso(addDays(mon, n))

  const clip = (id: string, date: string, position: number, category_id: string, title: string, over: Partial<Clip> = {}): Clip => ({
    id, date, position, category_id, title, script: SCRIPT, note: NOTE, created_by: 'u-owner',
    updated_at: subMinutes(now, 20 + position * 90).toISOString(),
    status: 'todo', revision_note: '', deleted_at: null, ...over,
  })

  const file = (id: string, clip_id: string, purpose: ClipMedia['purpose'], file_name: string, mime: string, size_bytes: number, created: Date, leftDays: number): ClipMedia => ({
    id, clip_id, purpose, file_name, mime, size_bytes, created_at: created.toISOString(),
    expires_at: addDays(now, leftDays).toISOString(), kind: mime.startsWith('image/') ? 'image' : 'video',
    r2_key: `fake/${id}`, status: 'ready', uploaded_by: purpose === 'submission' ? 'u-creator' : 'u-owner',
  })

  return {
    profiles: [
      { id: 'u-owner', role: 'owner', display_name: 'John Doe', email: 'owner@example.com', created_at: subDays(now, 30).toISOString() },
      { id: 'u-creator', role: 'creator', display_name: 'Mook', email: 'creator@example.com', created_at: subDays(now, 3).toISOString() },
    ],
    // shortcut: plaintext fake passwords, dev only; removed with this folder when Supabase Auth connects.
    passwords: { 'owner@example.com': 'owner1234', 'creator@example.com': 'creator1234' },
    categories: [
      { id: 'cat-review', name: 'รีวิว', position: 0, color: '#6155f5' },
      { id: 'cat-content', name: 'คอนเทนต์', position: 1, color: '#34c759' },
    ],
    clips: [
      clip('c1', today, 0, 'cat-review', 'รีวิว Tissot PRX 40 มม.', { status: 'submitted' }),
      clip('c2', today, 1, 'cat-content', 'วิธีดูแลนาฬิกาออโตเมติก', { status: 'revision', revision_note: 'ช่วยตัดช่วงกลางให้สั้นลง และเพิ่มภาพหน้าปัดตอนนาทีที่ 2' }),
      clip('c3', day(0), 2, 'cat-review', 'รีวิว Seiko Presage Cocktail Time', { status: 'approved' }),
      clip('c4', day(0), 3, 'cat-content', 'นาฬิกาสายหนัง vs สายเหล็ก'),
      clip('c5', day(1), 2, 'cat-review', 'รีวิว Casio G-Shock GA-2100'),
      clip('c6', day(4), 2, 'cat-content', 'นาฬิกาแบรนด์ไทยที่น่าจับตา'),
    ],
    media: [
      file('m1', 'c1', 'reference', 'prx_front.jpg', 'image/jpeg', 2_000_000, subDays(now, 1), 29),
      file('m2', 'c1', 'reference', 'prx_dial.jpg', 'image/jpeg', 2_000_000, subDays(now, 1), 5),
      file('m3', 'c1', 'reference', 'ref_intro.mp4', 'video/mp4', 80_000_000, subDays(now, 1), 29),
      file('m4', 'c1', 'submission', 'tissot_prx_v1.mp4', 'video/mp4', 820 * 1024 ** 2, subDays(now, 1), 29),
      file('m5', 'c1', 'submission', 'tissot_prx_v1_master.mov', 'video/quicktime', 1024 ** 3, subDays(now, 1), 5),
      file('m6', 'c1', 'submission', 'tissot_prx_v2.mp4', 'video/mp4', 1.8 * 1024 ** 3, subMinutes(now, 1), 30),
    ],
  }
}
