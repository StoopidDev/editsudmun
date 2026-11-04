# Frontend on a Fake Data Layer: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every v1 screen as a working app, matched closely to Figma, against a browser-only fake API, so it can be used by owner and creator before Buddy's backend exists.

**Architecture:** All data access goes through `src/api/index.ts`, whose functions use the spec's table shapes and mimic RLS role checks. Screens only call hooks in `src/api/queries.ts`. Connecting Supabase later replaces `src/api/index.ts` and `src/api/fake/`, and leaves the screens alone.

**Tech Stack:** React, Vite, TypeScript, Tailwind v4, shadcn/ui, TanStack Query, React Router, date-fns, sonner, lucide-react, Vitest.

**Decisions from the grilling (2026-11-04):**
- Fake layer now. No project for this app exists on the user's Supabase account, and `system-design.md` is not in the repo.
- Work status is in. Notifications are out.
- Look: close to Figma, per screen. No animation and no dark mode until the backend is connected.
- Search, undo delete, withdraw, retention badges and warning, draft autosave, and move up/down are in.
- **Upload is disabled.** Upload zones render but do nothing, until the backend exists. Uppy is not installed. All media in the app is seeded rows with no real file, so tiles show an icon and players show a placeholder.
- Login uses seeded accounts. Vitest covers logic only; screens are checked in the browser.

**Not in this plan (later plans):** real Supabase and R2, Uppy, notifications, dark mode, animation, drag reorder, image lightbox (nothing to enlarge without real files), the real product name.

**Reading Figma during execution:** join TalkToFigma channel `fmindj7m`. Each screen task names its node ids; export them with `export_node_as_image` before coding that screen and adjust spacing and sizes to match. The plugin only reaches the page open in Figma, and only "Desktop" exported on 2026-11-04 (a Mobile node failed). Ask the user to switch the open page before Task 15. `scan_text_nodes` timed out on 2026-11-04, so read copy from the exported image. All Thai copy below that differs from the frame loses to the frame.

**Commits:** the repo is initialised in Task 1. End every commit message with:
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

---

## File Structure

```
src/
  main.tsx               app entry, providers
  App.tsx                routes
  index.css              Tailwind and Figma tokens
  lib/types.ts           row types (spec tables plus assumed columns)
  lib/dates.ts           Monday-week helpers, Thai labels
  lib/media.ts           days left, withdraw window, rounds, size format
  lib/search.ts          match and snippet
  lib/status.ts          status labels and colors
  lib/lib.test.ts
  api/fake/seed.ts       seed rows, relative to today
  api/fake/db.ts         localStorage store
  api/index.ts           the whole data API
  api/api.test.ts
  api/queries.ts         TanStack Query hooks
  components/AppShell.tsx
  components/bits.tsx    CategoryBadge, StatusChip, FileTile, UploadDisabled, ConfirmDialog, DayStrip
  components/ClipCard.tsx
  components/DayDrawer.tsx
  components/CopyDialog.tsx
  pages/Login.tsx  Home.tsx  Calendar.tsx  ClipDetail.tsx  ClipForm.tsx
  pages/Review.tsx  Search.tsx  Categories.tsx  Users.tsx
```

---

### Task 1: Scaffold and tooling

**Files:** Create project root config, `.gitignore`, `src/` from the Vite template.

- [ ] **Step 1: Scaffold in a temp folder, then copy up.** The root already holds `CLAUDE.md` and `UX-FIX-PLAN.md`, so never run the scaffolder at the root with an overwrite flag.

```bash
npx create-vite@latest scaffold-tmp --template react-ts
cp -r scaffold-tmp/. .
rm -rf scaffold-tmp
npm install
git init
```

- [ ] **Step 2: Install dependencies**

```bash
npm i react-router-dom @tanstack/react-query date-fns sonner lucide-react @fontsource-variable/geist @fontsource-variable/noto-sans-thai
npm i -D tailwindcss @tailwindcss/vite vitest jsdom @types/node
```

- [ ] **Step 3: Replace `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: { environment: 'jsdom' },
})
```

- [ ] **Step 4: Add the alias to both `tsconfig.json` and `tsconfig.app.json`** under `compilerOptions`:

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 5: Add test script.** In `package.json` `scripts`, add `"test": "vitest run"`.

- [ ] **Step 6: Init shadcn and add components**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button input textarea label dialog dropdown-menu sheet
```

- [ ] **Step 7: Append tokens to `src/index.css`** after the shadcn block, and set `--primary: #0088ff; --primary-foreground: #fff; --radius: 10px;` in its `:root`. Delete any `.dark` block shadcn added: dark mode is out of scope and an OS dark setting must not half-apply it.

```css
@theme {
  --font-sans: "Geist Variable", "Noto Sans Thai Variable", sans-serif;
  --color-brand: #0088ff;
  --color-ink: #1e1e1e;
  --color-sub: #5f5f5f;
  --color-line: #757575;
  --color-surface: #f5f5f5;
  --color-grid: #d9d9d9;
  --color-today: #eaf4ff;
  --color-note: #fff4d6;
  --color-note-line: #ffcc00;
  --color-danger: #ff383c;
  --radius-card: 10px;
}
body { color: var(--color-ink); background: #fff; }
```

- [ ] **Step 8: Replace `src/main.tsx`** with a temporary render so the build proves out. Task 6 replaces it again.

```tsx
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-thai'
import './index.css'

createRoot(document.getElementById('root')!).render(<h1 className="text-brand">ทดสอบ</h1>)
```

Delete `src/App.css` and `src/App.tsx`.

- [ ] **Step 9: Verify**

Run: `npm run build`
Expected: exits 0. If the apostrophe or Thai characters in the folder path break a tool, stop and report it; do not rename the folder without asking.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React app with Tailwind and shadcn"
```

---

### Task 2: Domain logic

**Files:** Create `src/lib/types.ts`, `dates.ts`, `media.ts`, `search.ts`, `status.ts`, `lib.test.ts`.

- [ ] **Step 1: Write `src/lib/types.ts`**

```ts
// shortcut: hand-written rows, replace with Buddy's generated types when the backend connects.
export type Role = 'owner' | 'creator'
export type ClipStatus = 'todo' | 'submitted' | 'approved' | 'revision'

export interface Profile {
  id: string
  role: Role
  display_name: string
  email: string // assumption: not in profiles; the real value comes from auth
  created_at: string
}

export interface Category {
  id: string
  name: string
  position: number
  color: string // assumption: open question 1, ask Buddy to add
}

export interface Clip {
  id: string
  date: string // yyyy-MM-dd
  position: number
  category_id: string
  title: string
  script: string
  note: string
  created_by: string
  updated_at: string
  status: ClipStatus // assumption: not in spec, confirm with client
  revision_note: string // assumption: not in spec
  deleted_at: string | null // agreed with Buddy (D3), not yet in spec
}

export interface ClipMedia {
  id: string
  clip_id: string
  kind: 'image' | 'video'
  purpose: 'reference' | 'submission'
  r2_key: string
  file_name: string // assumption: spec has only r2_key
  mime: string
  size_bytes: number
  status: 'pending' | 'ready'
  uploaded_by: string
  created_at: string
  expires_at: string
}

export type ClipCardRow = Clip & { imageCount: number }
export type ClipInput = Pick<Clip, 'date' | 'category_id' | 'title' | 'script' | 'note'>
```

- [ ] **Step 2: Write the failing tests `src/lib/lib.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { dayLabel, monthGrid, rangeLabel, weekDays } from './dates'
import { canWithdraw, daysLeft, formatSize, isPlayable, withdrawMinutesLeft, withRounds } from './media'
import { searchClips, snippet } from './search'
import type { Clip, ClipMedia } from './types'

const media = (over: Partial<ClipMedia>): ClipMedia => ({
  id: 'm', clip_id: 'c', kind: 'video', purpose: 'submission', r2_key: 'k', file_name: 'f.mp4',
  mime: 'video/mp4', size_bytes: 1, status: 'ready', uploaded_by: 'u1',
  created_at: '2026-10-29T10:00:00.000Z', expires_at: '2026-11-28T10:00:00.000Z', ...over,
})

describe('dates', () => {
  it('starts weeks on Monday, even from a Sunday', () => {
    const days = weekDays(new Date(2026, 10, 1))
    expect(days[0].getDate()).toBe(26)
    expect(days).toHaveLength(7)
  })
  it('labels days and ranges in Thai', () => {
    expect(dayLabel(new Date(2026, 9, 29))).toBe('พฤหัส')
    expect(rangeLabel(new Date(2026, 9, 29))).toBe('26 ต.ค. – 1 พ.ย. 2026')
  })
  it('builds a month grid of whole weeks', () => {
    const grid = monthGrid(new Date(2026, 9, 15))
    expect(grid.length % 7).toBe(0)
    expect(grid[0].getDate()).toBe(28)
  })
})

describe('media', () => {
  const now = new Date('2026-10-29T10:03:00.000Z')
  it('counts days left and never goes negative', () => {
    expect(daysLeft('2026-11-03T10:00:00.000Z', now)).toBe(5)
    expect(daysLeft('2026-01-01T10:00:00.000Z', now)).toBe(0)
  })
  it('allows withdraw only for the uploader inside 10 minutes', () => {
    expect(withdrawMinutesLeft(media({}), now)).toBe(7)
    expect(canWithdraw(media({}), 'u1', now)).toBe(true)
    expect(canWithdraw(media({}), 'u2', now)).toBe(false)
    expect(canWithdraw(media({}), 'u1', new Date('2026-10-29T10:10:00.000Z'))).toBe(false)
    expect(canWithdraw(media({ purpose: 'reference' }), 'u1', now)).toBe(false)
  })
  it('numbers rounds oldest first and lists newest first', () => {
    const list = withRounds([
      media({ id: 'a', created_at: '2026-10-28T00:00:00.000Z' }),
      media({ id: 'b', created_at: '2026-10-29T00:00:00.000Z' }),
    ])
    expect(list.map((m) => [m.id, m.round])).toEqual([['b', 2], ['a', 1]])
  })
  it('detects browser-playable video', () => {
    expect(isPlayable('video/mp4')).toBe(true)
    expect(isPlayable('video/quicktime')).toBe(false)
  })
  it('formats sizes', () => {
    expect(formatSize(820 * 1024 ** 2)).toBe('820 MB')
    expect(formatSize(1.8 * 1024 ** 3)).toBe('1.8 GB')
  })
})

describe('search', () => {
  const clip = { title: 'รีวิว Tissot', script: 'x'.repeat(100) + ' Seiko ' + 'y'.repeat(100), note: 'ห้ามใช้เพลง' } as Clip
  it('matches title, script and note, ignoring case', () => {
    expect(searchClips([clip], 'tissot')).toHaveLength(1)
    expect(searchClips([clip], 'seiko')).toHaveLength(1)
    expect(searchClips([clip], 'เพลง')).toHaveLength(1)
    expect(searchClips([clip], 'casio')).toHaveLength(0)
    expect(searchClips([clip], '  ')).toHaveLength(0)
  })
  it('cuts a snippet around the match, keeping original case', () => {
    const s = snippet(clip.script, 'seiko', 10)
    expect(s.match).toBe('Seiko')
    expect(s.before.startsWith('…')).toBe(true)
    expect(s.after.endsWith('…')).toBe(true)
  })
  it('falls back to the text start when nothing matches', () => {
    const s = snippet('abc', 'zzz', 10)
    expect(s).toEqual({ before: 'abc', match: '', after: '' })
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test`
Expected: FAIL, modules not found. If instead every test errors on `localStorage` (Node 25 ships its own), add `--no-webstorage` to the Vitest worker's exec args in `vite.config.ts`.

- [ ] **Step 4: Write `src/lib/dates.ts`**

```ts
import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { th } from 'date-fns/locale'

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์']
const opts = { weekStartsOn: 1 } as const

export const toIso = (d: Date) => format(d, 'yyyy-MM-dd')
export const fromIso = (s: string) => parseISO(s)
export const todayIso = () => toIso(new Date())
export const weekStart = (d: Date) => startOfWeek(d, opts)
export const weekDays = (d: Date) => eachDayOfInterval({ start: weekStart(d), end: addDays(weekStart(d), 6) })
export const monthGrid = (d: Date) =>
  eachDayOfInterval({ start: weekStart(startOfMonth(d)), end: endOfWeek(endOfMonth(d), opts) })
export const dayLabel = (d: Date) => DAYS[(d.getDay() + 6) % 7]
export const shortDate = (d: Date) => format(d, 'd MMM', { locale: th })
export const fullDate = (d: Date) => `${dayLabel(d)} ${format(d, 'd MMM yyyy', { locale: th })}`
export const monthLabel = (d: Date) => format(d, 'MMMM yyyy', { locale: th })
export const rangeLabel = (d: Date) => {
  const [a, b] = [weekStart(d), addDays(weekStart(d), 6)]
  return `${shortDate(a)} – ${shortDate(b)} ${format(b, 'yyyy')}`
}
```

- [ ] **Step 5: Write `src/lib/media.ts`**

```ts
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { ClipMedia } from './types'

const WITHDRAW_MS = 10 * 60 * 1000
export const WARN_DAYS = 7

export const daysLeft = (expires_at: string, now = new Date()) =>
  Math.max(0, differenceInCalendarDays(parseISO(expires_at), now))

export const withdrawMinutesLeft = (m: ClipMedia, now = new Date()) =>
  Math.max(0, Math.ceil((parseISO(m.created_at).getTime() + WITHDRAW_MS - now.getTime()) / 60000))

export const canWithdraw = (m: ClipMedia, userId: string, now = new Date()) =>
  m.purpose === 'submission' && m.uploaded_by === userId && withdrawMinutesLeft(m, now) > 0

export const isPlayable = (mime: string) => mime === 'video/mp4' || mime === 'video/webm'

// shortcut: one file = one round, because the spec has no round column. Frame 103:2528 shows two
// files in round 1; ask Buddy for a round column if that grouping is wanted.
export const withRounds = (subs: ClipMedia[]) =>
  [...subs]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m, i) => ({ ...m, round: i + 1 }))
    .reverse()

export const formatSize = (bytes: number) => {
  const gb = bytes / 1024 ** 3
  return gb >= 1 ? `${+gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`
}
```

- [ ] **Step 6: Write `src/lib/search.ts`**

```ts
import type { Clip } from './types'

export function searchClips<T extends Pick<Clip, 'title' | 'script' | 'note'>>(clips: T[], q: string) {
  const needle = q.trim().toLowerCase()
  if (!needle) return []
  return clips.filter((c) => `${c.title}\n${c.script}\n${c.note}`.toLowerCase().includes(needle))
}

export function snippet(text: string, q: string, radius = 40) {
  const needle = q.trim().toLowerCase()
  const i = needle ? text.toLowerCase().indexOf(needle) : -1
  if (i < 0) return { before: text.slice(0, radius * 2), match: '', after: '' }
  const start = Math.max(0, i - radius)
  const end = Math.min(text.length, i + needle.length + radius)
  return {
    before: (start > 0 ? '…' : '') + text.slice(start, i),
    match: text.slice(i, i + needle.length),
    after: text.slice(i + needle.length, end) + (end < text.length ? '…' : ''),
  }
}
```

- [ ] **Step 7: Write `src/lib/status.ts`**

```ts
import type { ClipStatus } from './types'

export const STATUS: Record<ClipStatus, { label: string; className: string }> = {
  todo: { label: 'รอทำ', className: 'bg-[#eeeeee] text-sub' },
  submitted: { label: 'ส่งแล้ว', className: 'bg-today text-[#0066cc]' },
  approved: { label: 'ผ่าน', className: 'bg-[#e6f8ec] text-[#1a7f3c]' },
  revision: { label: 'แก้ไข', className: 'bg-[#fff0e0] text-[#b35c00]' },
}
```

- [ ] **Step 8: Run tests**

Run: `npm test`
Expected: all PASS. If `dayLabel` or `rangeLabel` month text differs, check the date-fns output and fix the implementation, not the expected Figma text.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add domain types and date, media, search logic"
```

---

### Task 3: Fake store and seed

**Files:** Create `src/api/fake/seed.ts`, `src/api/fake/db.ts`.

- [ ] **Step 1: Write `src/api/fake/seed.ts`.** Dates are relative to today so the calendar is never empty, and one submission is one minute old so withdraw can be tried. Positions on other days start at 2, so they stay unique when one of those days is today.

```ts
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
```

- [ ] **Step 2: Write `src/api/fake/db.ts`**

```ts
import { seed, type DB } from './seed'

const KEY = 'fake-db-v1'
let cache: DB | null = null

export function db(): DB {
  if (cache) return cache
  const raw = localStorage.getItem(KEY)
  cache = raw ? (JSON.parse(raw) as DB) : seed()
  return cache
}

export const save = () => localStorage.setItem(KEY, JSON.stringify(cache))

export function resetDb() {
  localStorage.removeItem(KEY)
  cache = null
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc -b`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add seeded localStorage store"
```

---

### Task 4: Data API with RLS-like checks

**Files:** Create `src/api/index.ts`, `src/api/api.test.ts`.

- [ ] **Step 1: Write the failing tests `src/api/api.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './index'
import { resetDb } from './fake/db'
import { todayIso } from '@/lib/dates'

const asOwner = () => api.login('owner@example.com', 'owner1234')
const asCreator = () => api.login('creator@example.com', 'creator1234')

beforeEach(() => {
  // Seed dates are relative to today, so pin a Thursday: the other seeded days never collide with it.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 29, 10))
  localStorage.clear()
  resetDb()
})

afterEach(() => vi.useRealTimers())

describe('auth', () => {
  it('rejects a wrong password', async () => {
    await expect(api.login('owner@example.com', 'nope')).rejects.toThrow('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  })
  it('returns the signed-in profile, and null after logout', async () => {
    await asOwner()
    expect(api.me()?.role).toBe('owner')
    api.logout()
    expect(api.me()).toBeNull()
  })
})

describe('permissions', () => {
  it('blocks creators from changing briefs', async () => {
    await asCreator()
    await expect(api.updateClip('c1', { title: 'x' })).rejects.toThrow('ไม่มีสิทธิ์')
    await expect(api.softDeleteClip('c1')).rejects.toThrow('ไม่มีสิทธิ์')
    await expect(api.createCategory('x', '#000000')).rejects.toThrow('ไม่มีสิทธิ์')
  })
  it('requires a session for reads', async () => {
    await expect(api.listCategories()).rejects.toThrow('กรุณาเข้าสู่ระบบ')
  })
})

describe('clips', () => {
  it('lists a day in position order with image counts', async () => {
    await asOwner()
    const rows = await api.listClips(todayIso(), todayIso())
    expect(rows.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(rows[0].imageCount).toBe(2)
  })
  it('hides a soft-deleted clip and restores it', async () => {
    await asOwner()
    await api.softDeleteClip('c1')
    expect((await api.listClips(todayIso(), todayIso())).map((c) => c.id)).toEqual(['c2'])
    await api.restoreClip('c1')
    expect((await api.listClips(todayIso(), todayIso()))).toHaveLength(2)
  })
  it('moves a clip within its day and stops at the edges', async () => {
    await asOwner()
    await api.moveClip('c2', -1)
    expect((await api.listClips(todayIso(), todayIso())).map((c) => c.id)).toEqual(['c2', 'c1'])
    await api.moveClip('c2', -1)
    expect((await api.listClips(todayIso(), todayIso())).map((c) => c.id)).toEqual(['c2', 'c1'])
  })
  it('appends to the end of the day on create and on date change', async () => {
    await asOwner()
    const made = await api.createClip({ date: todayIso(), category_id: 'cat-review', title: 'ใหม่', script: '', note: '' })
    expect(made.position).toBe(2)
    const moved = await api.updateClip('c5', { date: todayIso() })
    expect(moved.position).toBe(3)
  })
  it('copies text and references, not submissions, and resets status', async () => {
    await asOwner()
    const copy = await api.copyClip('c1', '2030-01-01')
    expect(copy.status).toBe('todo')
    const media = await api.listMedia(copy.id)
    expect(media.every((m) => m.purpose === 'reference')).toBe(true)
    expect(media).toHaveLength(3)
  })
  it('searches clips and skips deleted ones', async () => {
    await asOwner()
    expect((await api.search('Casio')).map((c) => c.id)).toEqual(['c5'])
    await api.softDeleteClip('c5')
    expect(await api.search('Casio')).toEqual([])
  })
})

describe('status', () => {
  it('needs a reason for a change request and clears it on approve', async () => {
    await asOwner()
    await expect(api.reviewClip('c1', 'revision', '  ')).rejects.toThrow('กรุณาระบุเหตุผล')
    expect((await api.reviewClip('c1', 'revision', 'แก้เสียง')).revision_note).toBe('แก้เสียง')
    expect((await api.reviewClip('c1', 'approved')).revision_note).toBe('')
  })
  it('is owner-only', async () => {
    await asCreator()
    await expect(api.reviewClip('c1', 'approved')).rejects.toThrow('ไม่มีสิทธิ์')
  })
})

describe('media', () => {
  it('lets the creator withdraw a fresh submission but not an old one', async () => {
    await asCreator()
    await api.withdrawMedia('m6')
    expect((await api.listMedia('c1')).some((m) => m.id === 'm6')).toBe(false)
    await expect(api.withdrawMedia('m4')).rejects.toThrow('หมดเวลาถอนไฟล์')
  })
  it('resets status to todo when the last submission is withdrawn', async () => {
    await asOwner()
    await api.deleteMedia('m4')
    await api.deleteMedia('m5')
    await asCreator()
    await api.withdrawMedia('m6')
    expect((await api.getClip('c1'))?.status).toBe('todo')
  })
  it('blocks creators from the owner delete', async () => {
    await asCreator()
    await expect(api.deleteMedia('m6')).rejects.toThrow('ไม่มีสิทธิ์')
  })
})

describe('categories and users', () => {
  it('refuses to delete a category in use, allows an unused one', async () => {
    await asOwner()
    await expect(api.deleteCategory('cat-review')).rejects.toThrow('ยังมีคลิป')
    const c = await api.createCategory('ไลฟ์', '#ff9500')
    await api.deleteCategory(c.id)
    expect((await api.listCategories()).map((x) => x.id)).not.toContain(c.id)
  })
  it('creates a creator who can log in with the temporary password', async () => {
    await asOwner()
    const { tempPassword } = await api.createCreator('New', 'new@example.com')
    await api.login('new@example.com', tempPassword)
    expect(api.me()?.role).toBe('creator')
  })
  it('rejects a duplicate email and refuses to delete the owner', async () => {
    await asOwner()
    await expect(api.createCreator('X', 'creator@example.com')).rejects.toThrow('อีเมลนี้')
    await expect(api.deleteUser('u-owner')).rejects.toThrow('ลบบัญชีเจ้าของไม่ได้')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL, `./index` not found.

- [ ] **Step 3: Write `src/api/index.ts`**

```ts
// Everything the UI may do to data. Replace this file and ./fake with Supabase calls later;
// the checks below mimic RLS for realistic behaviour and are not real security.
import { canWithdraw } from '@/lib/media'
import { searchClips } from '@/lib/search'
import type { Category, Clip, ClipCardRow, ClipInput, ClipMedia, Profile, Role } from '@/lib/types'
import { db, save } from './fake/db'

const SESSION = 'fake-session'
const wait = () => new Promise((r) => setTimeout(r, import.meta.env.MODE === 'test' ? 0 : 150))

export function me(): Profile | null {
  const id = localStorage.getItem(SESSION)
  return db().profiles.find((p) => p.id === id) ?? null
}

function need(role?: Role) {
  const u = me()
  if (!u) throw new Error('กรุณาเข้าสู่ระบบ')
  if (role && u.role !== role) throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
  return u
}

const live = () => db().clips.filter((c) => !c.deleted_at)
const uid = () => crypto.randomUUID()
const stamp = () => new Date().toISOString()
const nextPosition = (date: string) => Math.max(-1, ...live().filter((c) => c.date === date).map((c) => c.position)) + 1
const toCard = (c: Clip): ClipCardRow => ({
  ...c,
  imageCount: db().media.filter((m) => m.clip_id === c.id && m.purpose === 'reference' && m.kind === 'image').length,
})
const clipOf = (id: string) => {
  const c = db().clips.find((x) => x.id === id)
  if (!c) throw new Error('ไม่พบคลิป')
  return c
}

// Auth
export async function login(email: string, password: string) {
  await wait()
  const user = db().profiles.find((p) => p.email === email.trim().toLowerCase())
  if (!user || db().passwords[user.email] !== password) throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  localStorage.setItem(SESSION, user.id)
  return user
}
export const logout = () => localStorage.removeItem(SESSION)

// Clips
export async function listClips(from: string, to: string) {
  await wait()
  need()
  return live()
    .filter((c) => c.date >= from && c.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position)
    .map(toCard)
}

export async function listRecent(limit: number) {
  await wait()
  need()
  return [...live()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, limit)
}

export async function getClip(id: string) {
  await wait()
  need()
  return live().find((c) => c.id === id) ?? null
}

export async function createClip(input: ClipInput) {
  await wait()
  const u = need('owner')
  const clip: Clip = {
    ...input, id: uid(), position: nextPosition(input.date), created_by: u.id, updated_at: stamp(),
    status: 'todo', revision_note: '', deleted_at: null,
  }
  db().clips.push(clip)
  save()
  return clip
}

export async function updateClip(id: string, patch: Partial<ClipInput>) {
  await wait()
  need('owner')
  const c = clipOf(id)
  if (patch.date && patch.date !== c.date) c.position = nextPosition(patch.date)
  Object.assign(c, patch, { updated_at: stamp() })
  save()
  return c
}

export async function softDeleteClip(id: string) {
  await wait()
  need('owner')
  clipOf(id).deleted_at = stamp()
  save()
}

export async function restoreClip(id: string) {
  await wait()
  need('owner')
  clipOf(id).deleted_at = null
  save()
}

export async function moveClip(id: string, dir: -1 | 1) {
  await wait()
  need('owner')
  const c = clipOf(id)
  const day = live().filter((x) => x.date === c.date).sort((a, b) => a.position - b.position)
  const other = day[day.findIndex((x) => x.id === id) + dir]
  if (!other) return
  ;[c.position, other.position] = [other.position, c.position]
  save()
}

export async function copyClip(id: string, date: string) {
  await wait()
  const u = need('owner')
  const src = clipOf(id)
  const copy: Clip = {
    ...src, id: uid(), date, position: nextPosition(date), created_by: u.id, updated_at: stamp(),
    status: 'todo', revision_note: '',
  }
  db().clips.push(copy)
  const refs = db().media.filter((m) => m.clip_id === id && m.purpose === 'reference')
  db().media.push(...refs.map((m) => ({ ...m, id: uid(), clip_id: copy.id })))
  save()
  return copy
}

export async function reviewClip(id: string, status: 'approved' | 'revision', note = '') {
  await wait()
  need('owner')
  if (status === 'revision' && !note.trim()) throw new Error('กรุณาระบุเหตุผลที่ขอแก้ไข')
  const c = clipOf(id)
  c.status = status
  c.revision_note = status === 'revision' ? note.trim() : ''
  c.updated_at = stamp()
  save()
  return c
}

export async function search(q: string) {
  await wait()
  need()
  return searchClips(live(), q).sort((a, b) => b.date.localeCompare(a.date))
}

// Media
export async function listMedia(clipId: string) {
  await wait()
  need()
  return db().media.filter((m) => m.clip_id === clipId)
}

function dropMedia(id: string) {
  const d = db()
  const m = d.media.find((x) => x.id === id)
  if (!m) return
  d.media = d.media.filter((x) => x.id !== id)
  const left = d.media.some((x) => x.clip_id === m.clip_id && x.purpose === 'submission')
  if (m.purpose === 'submission' && !left) clipOf(m.clip_id).status = 'todo'
  save()
}

export async function deleteMedia(id: string) {
  await wait()
  need('owner')
  dropMedia(id)
}

export async function withdrawMedia(id: string) {
  await wait()
  const u = need('creator')
  const m = db().media.find((x) => x.id === id)
  if (!m || !canWithdraw(m, u.id)) throw new Error('หมดเวลาถอนไฟล์นี้แล้ว')
  dropMedia(id)
}

export async function storageUsedBytes() {
  await wait()
  need('owner')
  return db().media.reduce((sum, m) => sum + m.size_bytes, 0)
}

// Categories
export async function listCategories() {
  await wait()
  need()
  return [...db().categories].sort((a, b) => a.position - b.position)
}

export async function categoryCounts() {
  await wait()
  need()
  const counts: Record<string, number> = {}
  for (const c of live()) counts[c.category_id] = (counts[c.category_id] ?? 0) + 1
  return counts
}

export async function createCategory(name: string, color: string) {
  await wait()
  need('owner')
  const cat: Category = { id: uid(), name, color, position: db().categories.length }
  db().categories.push(cat)
  save()
  return cat
}

export async function updateCategory(id: string, patch: Pick<Category, 'name' | 'color'>) {
  await wait()
  need('owner')
  Object.assign(db().categories.find((c) => c.id === id) ?? {}, patch)
  save()
}

export async function deleteCategory(id: string) {
  await wait()
  need('owner')
  if (live().some((c) => c.category_id === id)) throw new Error('ลบไม่ได้ ยังมีคลิปในประเภทนี้')
  db().categories = db().categories.filter((c) => c.id !== id)
  save()
}

// Users (the real version calls the create-creator Edge Function)
const tempPassword = () => Math.random().toString(36).slice(2, 10)

export async function listUsers() {
  await wait()
  need('owner')
  return db().profiles
}

export async function createCreator(display_name: string, rawEmail: string) {
  await wait()
  need('owner')
  const email = rawEmail.trim().toLowerCase()
  if (db().profiles.some((p) => p.email === email)) throw new Error('อีเมลนี้มีบัญชีอยู่แล้ว')
  const user: Profile = { id: uid(), role: 'creator', display_name, email, created_at: stamp() }
  const password = tempPassword()
  db().profiles.push(user)
  db().passwords[email] = password
  save()
  return { user, tempPassword: password }
}

export async function resetPassword(id: string) {
  await wait()
  need('owner')
  const user = db().profiles.find((p) => p.id === id)
  if (!user) throw new Error('ไม่พบผู้ใช้')
  const password = tempPassword()
  db().passwords[user.email] = password
  save()
  return password
}

export async function deleteUser(id: string) {
  await wait()
  need('owner')
  const user = db().profiles.find((p) => p.id === id)
  if (user?.role === 'owner') throw new Error('ลบบัญชีเจ้าของไม่ได้')
  db().profiles = db().profiles.filter((p) => p.id !== id)
  save()
}

```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add fake data API with role checks"
```

---

### Task 5: Query hooks, shared bits, app shell, routes, login

**Figma:** sidebar and header from `63:160`; creator nav from `63:387`; login `92:1279`, loading `92:1301`, error `92:1324`.

**Files:** Create `src/api/queries.ts`, `src/components/bits.tsx`, `src/components/AppShell.tsx`, `src/pages/Login.tsx`, `src/App.tsx`. Modify `src/main.tsx`.

- [ ] **Step 1: Write `src/api/queries.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as api from './index'

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: async () => api.me() })
export const useClips = (from: string, to: string) =>
  useQuery({ queryKey: ['clips', from, to], queryFn: () => api.listClips(from, to) })
export const useRecent = (limit: number) => useQuery({ queryKey: ['recent', limit], queryFn: () => api.listRecent(limit) })
export const useClip = (id: string) => useQuery({ queryKey: ['clip', id], queryFn: () => api.getClip(id) })
export const useMedia = (clipId: string) => useQuery({ queryKey: ['media', clipId], queryFn: () => api.listMedia(clipId) })
export const useSearch = (q: string) => useQuery({ queryKey: ['search', q], queryFn: () => api.search(q), enabled: !!q.trim() })
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: api.listCategories })
export const useCategoryCounts = () => useQuery({ queryKey: ['categoryCounts'], queryFn: api.categoryCounts })
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: api.listUsers })
export const useStorage = (enabled: boolean) =>
  useQuery({ queryKey: ['storage'], queryFn: api.storageUsedBytes, enabled })

// shortcut: every write refetches everything; narrow the invalidation if a real backend makes this slow.
export function useAct<A, R>(fn: (arg: A) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteClip() {
  const qc = useQueryClient()
  return async (id: string) => {
    await api.softDeleteClip(id)
    await qc.invalidateQueries()
    toast('ลบคลิปแล้ว', {
      duration: 10_000,
      action: {
        label: 'เลิกทำ',
        onClick: () => void api.restoreClip(id).then(() => qc.invalidateQueries()),
      },
    })
  }
}
```

- [ ] **Step 2: Write `src/components/bits.tsx`**

```tsx
import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Play, Upload } from 'lucide-react'
import { useCategories } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { dayLabel, fromIso, toIso, todayIso, weekDays } from '@/lib/dates'
import { daysLeft } from '@/lib/media'
import { STATUS } from '@/lib/status'
import type { ClipMedia, ClipStatus } from '@/lib/types'
import { addDays } from 'date-fns'

export function CategoryBadge({ categoryId }: { categoryId: string }) {
  const { data } = useCategories()
  const cat = data?.find((c) => c.id === categoryId)
  if (!cat) return null
  return (
    <span className="inline-block rounded-md border bg-white px-2 py-0.5 text-xs font-bold" style={{ color: cat.color, borderColor: cat.color }}>
      {cat.name}
    </span>
  )
}

export function StatusChip({ status }: { status: ClipStatus }) {
  const s = STATUS[status]
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${s.className}`}>{s.label}</span>
}

export function FileTile({ file, onDelete }: { file: ClipMedia; onDelete?: () => void }) {
  const isVideo = file.kind === 'video'
  return (
    <div className={`relative flex h-20 flex-col items-center justify-center gap-1 rounded-card px-2 ${isVideo ? 'bg-[#1e1e1e] text-white' : 'bg-surface text-sub'}`}>
      {isVideo ? <Play size={18} /> : <ImageIcon size={18} />}
      <span className="w-full truncate text-center text-xs">{file.file_name}</span>
      <span className="text-xs">ลบใน {daysLeft(file.expires_at)} วัน</span>
      {onDelete && (
        <button aria-label={`ลบ ${file.file_name}`} onClick={onDelete} className="absolute top-1 right-1 size-5 rounded-full bg-ink text-xs text-white">×</button>
      )}
    </div>
  )
}

export function UploadDisabled({ label }: { label: string }) {
  return (
    <div aria-disabled className="flex cursor-not-allowed flex-col items-center gap-1 rounded-card border border-dashed border-line p-4 text-center text-xs text-sub opacity-70">
      <Upload size={16} />
      <span>{label}</span>
      <span>เปิดใช้เมื่อเชื่อมต่อระบบหลังบ้านแล้ว</span>
    </div>
  )
}

export function ConfirmDialog(props: {
  open: boolean; title: string; body: ReactNode; confirm: string
  onConfirm: () => void; onClose: () => void
}) {
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={props.onClose}>ยกเลิก</Button>
          <Button className="bg-danger text-white hover:bg-danger/90" onClick={() => { props.onConfirm(); props.onClose() }}>{props.confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DayStrip({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [anchor, setAnchor] = useState(() => fromIso(value))
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" aria-label="สัปดาห์ก่อน" onClick={() => setAnchor(addDays(anchor, -7))}><ChevronLeft /></Button>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {weekDays(anchor).map((d) => {
          const iso = toIso(d)
          const cls = iso === value ? 'bg-brand text-white' : iso === todayIso() ? 'border border-brand bg-today' : 'bg-surface'
          return (
            <button key={iso} onClick={() => onChange(iso)} className={`rounded-card p-2 text-center text-xs ${cls}`}>
              {dayLabel(d)}<br /><b className="text-base">{d.getDate()}</b>
            </button>
          )
        })}
      </div>
      <Button variant="outline" size="icon" aria-label="สัปดาห์ถัดไป" onClick={() => setAnchor(addDays(anchor, 7))}><ChevronRight /></Button>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/components/AppShell.tsx`.** Full sidebar at `lg`, 64 px icon rail at `md`, hamburger Sheet below `md`. The globe and moon stay disabled until dark mode lands. The logout link is not in Figma; it is needed to switch roles while testing.

```tsx
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Calendar, Globe, Home, Menu, Moon, Search, Tag, User, Users } from 'lucide-react'
import * as api from '@/api/index'
import { useMe } from '@/api/queries'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

const NAV = [
  { to: '/', label: 'หน้าแรก', icon: Home, owner: false },
  { to: '/calendar', label: 'ปฏิทิน', icon: Calendar, owner: false },
  { to: '/categories', label: 'ประเภทคลิป', icon: Tag, owner: true },
  { to: '/users', label: 'ผู้ใช้งาน', icon: Users, owner: true },
]

const TITLES: [string, string][] = [
  ['/calendar', 'ปฏิทิน'], ['/clips/new', 'เพิ่มคลิป'], ['/clips', 'รายละเอียดคลิป'],
  ['/categories', 'ประเภทคลิป'], ['/users', 'ผู้ใช้งาน'], ['/search', 'ค้นหา'],
]

function Sidebar({ rail, onNavigate }: { rail?: boolean; onNavigate?: () => void }) {
  const { data: me } = useMe()
  const qc = useQueryClient()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q')?.toString().trim()
    if (q) { nav(`/search?q=${encodeURIComponent(q)}`); onNavigate?.() }
  }

  const logout = () => {
    api.logout()
    qc.clear()
    nav('/login')
  }

  return (
    <div className="flex h-full flex-col gap-4 bg-surface p-3">
      {!rail && <Link to="/" className="px-2 py-2 text-lg">Channel's Tool</Link>}
      {rail ? (
        <Link to="/search" aria-label="ค้นหา" className="flex justify-center p-2"><Search size={18} /></Link>
      ) : (
        <form onSubmit={submit} className="flex items-center gap-2 rounded-card border border-line bg-[#e6e6e6] px-2 py-1.5">
          <Search size={16} />
          <input ref={input} name="q" defaultValue={params.get('q') ?? ''} placeholder="ค้นหาคลิป..." aria-label="ค้นหาคลิป" className="w-full bg-transparent text-sm outline-none" />
          <kbd className="rounded bg-white px-1 text-xs text-sub">Ctrl K</kbd>
        </form>
      )}
      <nav className="flex flex-col gap-1">
        {NAV.filter((n) => !n.owner || me?.role === 'owner').map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} aria-label={label}
            className={({ isActive }) => `flex items-center gap-2 rounded-card px-2 py-2 text-sm ${rail ? 'justify-center' : ''} ${isActive ? 'bg-brand text-white' : ''}`}>
            <Icon size={16} />{!rail && label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-2 px-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-ink text-white"><User size={16} /></span>
        {!rail && (
          <div className="text-sm">
            <b>{me?.display_name}</b>
            <div className="text-xs text-sub">{me?.role === 'owner' ? 'เจ้าของ' : 'ครีเอเตอร์'}</div>
            <button onClick={logout} className="text-xs text-sub underline">ออกจากระบบ</button>
          </div>
        )}
      </div>
    </div>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const title = TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? 'หน้าแรก'
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 lg:block"><Sidebar /></aside>
      <aside className="sticky top-0 hidden h-dvh w-16 shrink-0 md:block lg:hidden"><Sidebar rail /></aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">เมนู</SheetTitle>
          <Sidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2">
            <button className="md:hidden" aria-label="เปิดเมนู" onClick={() => setOpen(true)}><Menu /></button>
            <span className="text-lg">{title}</span>
          </div>
          <div className="flex gap-3 text-sub">
            <button disabled aria-label="ภาษา (ยังไม่เปิดใช้)"><Globe size={18} /></button>
            <button disabled aria-label="โหมดมืด (ยังไม่เปิดใช้)"><Moon size={18} /></button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6"><Outlet /></main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write `src/pages/Login.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import * as api from '@/api/index'
import { useMe } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function Login() {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const [show, setShow] = useState(false)
  // Plain useMutation, not useAct: the error shows inline here, not as a toast.
  const act = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.login(email, password),
    onSuccess: () => qc.invalidateQueries(),
  })

  if (me) return <Navigate to="/" replace />

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    act.mutate({ email: String(f.get('email')), password: String(f.get('password')) })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-card bg-white p-8">
        <h1 className="text-center text-xl">Channel's Tool</h1>
        <div className="grid gap-1">
          <Label htmlFor="email">อีเมล</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="password">รหัสผ่าน</Label>
          <div className="relative">
            <Input id="password" name="password" type={show ? 'text' : 'password'} required autoComplete="current-password" />
            <button type="button" aria-label="แสดงรหัสผ่าน" onClick={() => setShow(!show)} className="absolute top-2 right-2 text-sub">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {act.error && <p role="alert" className="text-sm text-danger">{act.error.message}</p>}
        <Button type="submit" disabled={act.isPending}>{act.isPending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</Button>
        <p className="text-center text-xs text-sub">ลืมรหัสผ่าน? ติดต่อเจ้าของช่องเพื่อรีเซ็ต</p>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/App.tsx`.** It imports all pages, so create each remaining page as a stub first: `export function Home() { return null }` (same for `Calendar`, `ClipDetail`, `Search`, `Categories`, `Users`). Tasks 6 to 13 replace them.

```tsx
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useMe } from '@/api/queries'
import { AppShell } from '@/components/AppShell'
import { Calendar } from '@/pages/Calendar'
import { Categories } from '@/pages/Categories'
import { ClipDetail } from '@/pages/ClipDetail'
import { Home } from '@/pages/Home'
import { Login } from '@/pages/Login'
import { Search } from '@/pages/Search'
import { Users } from '@/pages/Users'

function RequireAuth() {
  const { data: me, isPending } = useMe()
  if (isPending) return null
  return me ? <Outlet /> : <Navigate to="/login" replace />
}

function RequireOwner() {
  const { data: me } = useMe()
  return me?.role === 'owner' ? <Outlet /> : <Navigate to="/" replace />
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="clips/:id" element={<ClipDetail />} />
            <Route path="search" element={<Search />} />
            <Route element={<RequireOwner />}>
              <Route path="categories" element={<Categories />} />
              <Route path="users" element={<Users />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

`/clips/new` is handled inside `ClipDetail` (Task 9), which shows `ClipForm` for owners and redirects creators.

- [ ] **Step 6: Replace `src/main.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-thai'
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}>
    <App />
    <Toaster position="bottom-center" theme="light" />
  </QueryClientProvider>,
)
```

- [ ] **Step 7: Verify in the browser**

Add a `.claude/launch.json` entry named `web` running `npm run dev` on port 5173, then start it with `preview_start`.
Expected: `/` redirects to `/login`. A wrong password shows the error. `owner@example.com` / `owner1234` lands on the shell with 4 nav items. `creator@example.com` / `creator1234` shows 2, and `/users` redirects to `/`. Ctrl+K focuses search. Reload keeps the session. Compare the shell and login to `63:160` and `92:1279`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add app shell, routing, and login"
```

---

### Task 6: ClipCard and Home

**Figma:** owner `63:160`, creator `63:387`, owner with storage `103:2885`. Recently Edited shows only "อัปเดตล่าสุด" plus time.

**Files:** Create `src/components/ClipCard.tsx`. Replace `src/pages/Home.tsx`.

- [ ] **Step 1: Write `src/components/ClipCard.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { FileText, Image as ImageIcon } from 'lucide-react'
import { CategoryBadge, StatusChip } from '@/components/bits'
import type { ClipCardRow } from '@/lib/types'

export function ClipCard({ clip }: { clip: ClipCardRow }) {
  return (
    <Link to={`/clips/${clip.id}`} className="flex flex-col gap-1 rounded-card border border-line bg-white p-2 hover:bg-surface">
      <div className="flex flex-wrap items-center gap-1">
        <CategoryBadge categoryId={clip.category_id} />
        <StatusChip status={clip.status} />
      </div>
      <b className="text-sm">{clip.title}</b>
      <div className="flex gap-2 text-xs text-sub">
        {clip.imageCount > 0 && <span className="flex items-center gap-1"><ImageIcon size={12} />{clip.imageCount}</span>}
        {clip.note && <span className="flex items-center gap-1"><FileText size={12} />หมายเหตุ</span>}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Replace `src/pages/Home.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { ArrowRight, Plus } from 'lucide-react'
import { useCategories, useClips, useMe, useRecent, useStorage } from '@/api/queries'
import { CategoryBadge } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { dayLabel, fullDate, rangeLabel, toIso, todayIso, weekDays } from '@/lib/dates'
import { formatSize } from '@/lib/media'

export function Home() {
  const today = todayIso()
  const now = new Date()
  const days = weekDays(now)
  const { data: me } = useMe()
  const owner = me?.role === 'owner'
  const week = useClips(toIso(days[0]), toIso(days[6]))
  const recent = useRecent(4)
  const storage = useStorage(owner)
  const { data: cats } = useCategories()
  const todays = week.data?.filter((c) => c.date === today) ?? []
  const color = (id: string) => cats?.find((c) => c.id === id)?.color

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ยินดีต้อนรับกลับมา</h1>
        {owner && <Button asChild><Link to={`/clips/new?date=${today}`}><Plus />เพิ่มคลิป</Link></Button>}
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex justify-between">
          <h2 className="text-lg">วันนี้ · {fullDate(now)}</h2>
          <Link to="/calendar" className="flex items-center gap-1 text-sm text-brand">เปิดปฏิทิน<ArrowRight size={14} /></Link>
        </div>
        {week.isPending ? <p className="text-sm text-sub">กำลังโหลด...</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todays.map((c, i) => (
              <Link key={c.id} to={`/clips/${c.id}`} className="flex flex-col gap-1 rounded-card border border-line p-3 hover:bg-surface">
                <div className="flex justify-between text-xs text-sub"><CategoryBadge categoryId={c.category_id} />คลิป {i + 1} จาก {todays.length}</div>
                <b>{c.title}</b>
                <p className="line-clamp-2 text-xs text-sub">{c.script}</p>
              </Link>
            ))}
            {todays.length === 0 && !owner && <p className="text-sm text-sub">วันนี้ไม่มีคลิป</p>}
            {owner && (
              <Link to={`/clips/new?date=${today}`} className="flex min-h-24 flex-col items-center justify-center rounded-card border border-dashed border-line text-sm text-sub">
                <Plus size={16} />เพิ่มคลิปวันนี้
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex justify-between">
          <h2 className="text-lg">สัปดาห์นี้</h2>
          <span className="text-sm text-sub">{rangeLabel(now)} · <Link to="/calendar" className="text-brand">ดูทั้งหมด</Link></span>
        </div>
        <div className="grid grid-cols-1 overflow-hidden rounded-card border border-line sm:grid-cols-7">
          {days.map((d) => {
            const iso = toIso(d)
            const list = week.data?.filter((c) => c.date === iso) ?? []
            return (
              <Link key={iso} to={`/calendar?date=${iso}`} className={`flex min-h-24 flex-col gap-1 border-grid p-2 sm:border-r ${iso === today ? 'bg-today' : ''}`}>
                <span className={`rounded-card text-center text-xs ${iso === today ? 'bg-brand text-white' : ''}`}>{dayLabel(d)}<br /><b className="text-base">{d.getDate()}</b></span>
                {list.slice(0, 3).map((c) => (
                  <span key={c.id} className="truncate rounded px-1 text-xs font-bold text-white" style={{ background: color(c.category_id) }}>{c.title}</span>
                ))}
                <span className="text-xs text-sub">{list.length ? `${list.length} คลิป` : 'ไม่มีคลิป'}</span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">แก้ไขล่าสุด</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {recent.data?.map((c) => (
            <Link key={c.id} to={`/clips/${c.id}`} className="flex flex-col gap-1 rounded-card border border-line p-3 hover:bg-surface">
              <div className="flex justify-between text-xs text-sub">
                <CategoryBadge categoryId={c.category_id} />
                {formatDistanceToNow(parseISO(c.updated_at), { locale: th, addSuffix: true })}
              </div>
              <b className="text-sm">{c.title}</b>
              <span className="text-xs text-sub">อัปเดตล่าสุด</span>
            </Link>
          ))}
        </div>
      </section>

      {owner && storage.data !== undefined && (
        <section className="rounded-card border border-line p-3">
          <h2 className="text-lg">พื้นที่จัดเก็บ</h2>
          <p className="text-sm text-sub">ใช้ไปแล้ว {formatSize(storage.data)}</p>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify in the browser.** Compare to `63:160` and `103:2885`, adjusting spacing and sizes. Expected: today's two clips, the 7-day strip with today highlighted, four recent cards. The creator sees no add buttons and no storage widget.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add home page"
```

---

### Task 7: Calendar and day drawer

**Figma:** week `54:54`, creator `60:317`, status chips `108:20704`, dense `102:1413`, empty `102:1676`, loading `102:1935`, month `65:96`, `65:619`, drawer `74:12986`, `74:13528`, undo toast `112:2079`, copy modal `74:1692`.

**Files:** Create `src/components/DayDrawer.tsx`, `src/components/CopyDialog.tsx`. Replace `src/pages/Calendar.tsx`.

- [ ] **Step 1: Write `src/components/CopyDialog.tsx`**

```tsx
import { useState } from 'react'
import * as api from '@/api/index'
import { useAct } from '@/api/queries'
import { DayStrip } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fromIso, fullDate } from '@/lib/dates'
import type { Clip } from '@/lib/types'
import { toast } from 'sonner'

export function CopyDialog({ clip, onClose }: { clip: Pick<Clip, 'id' | 'title' | 'date'>; onClose: () => void }) {
  const [date, setDate] = useState(clip.date)
  const copy = useAct(() => api.copyClip(clip.id, date))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>คัดลอกไปวันอื่น</DialogTitle>
          <DialogDescription>เลือกวันที่จะวางคลิปนี้ พร้อมสคริปต์ หมายเหตุ และรูปภาพ</DialogDescription>
        </DialogHeader>
        <div className="rounded-card bg-surface p-3 text-sm"><b>{clip.title}</b><br /><span className="text-xs text-sub">จากวัน{fullDate(fromIso(clip.date))}</span></div>
        <DayStrip value={date} onChange={setDate} />
        <p className="text-sm text-brand">วันที่เลือก: {fullDate(fromIso(date))}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button disabled={copy.isPending} onClick={() => copy.mutate(undefined, { onSuccess: () => { toast.success('คัดลอกแล้ว'); onClose() } })}>คัดลอก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Write `src/components/DayDrawer.tsx`.** Drag handles are out of scope; move up/down replaces them.

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import * as api from '@/api/index'
import { useAct, useCategories, useClips, useDeleteClip, useMe } from '@/api/queries'
import { CopyDialog } from '@/components/CopyDialog'
import { ClipCard } from '@/components/ClipCard'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { fromIso, fullDate } from '@/lib/dates'
import type { ClipCardRow } from '@/lib/types'

export function DayDrawer({ date, onClose }: { date: string; onClose: () => void }) {
  const nav = useNavigate()
  const { data: me } = useMe()
  const { data: clips = [] } = useClips(date, date)
  const { data: cats = [] } = useCategories()
  const [filter, setFilter] = useState<string | null>(null)
  const [copying, setCopying] = useState<ClipCardRow | null>(null)
  const move = useAct(({ id, dir }: { id: string; dir: -1 | 1 }) => api.moveClip(id, dir))
  const del = useDeleteClip()
  const owner = me?.role === 'owner'
  const shown = filter ? clips.filter((c) => c.category_id === filter) : clips

  const chip = (id: string | null, label: string, n: number) => (
    <button key={id ?? 'all'} onClick={() => setFilter(id)} className={`rounded-full border border-line px-3 py-1 text-xs ${filter === id ? 'bg-brand text-white' : ''}`}>
      {label} {n}
    </button>
  )

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-3 p-4 sm:max-w-[420px]">
        <SheetTitle>{fullDate(fromIso(date))}</SheetTitle>
        <SheetDescription>{clips.length} คลิป</SheetDescription>
        <div className="flex flex-wrap gap-2">
          {chip(null, 'ทั้งหมด', clips.length)}
          {cats.map((c) => chip(c.id, c.name, clips.filter((x) => x.category_id === c.id).length))}
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {shown.map((c) => (
            <div key={c.id} className="flex items-start gap-1">
              <div className="flex-1"><ClipCard clip={c} /></div>
              {owner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`เมนู ${c.title}`}><MoreHorizontal /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => nav(`/clips/${c.id}`)}><Pencil />แก้ไข</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCopying(c)}><Copy />คัดลอก</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => move.mutate({ id: c.id, dir: -1 })}><ArrowUp />ย้ายขึ้น</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => move.mutate({ id: c.id, dir: 1 })}><ArrowDown />ย้ายลง</DropdownMenuItem>
                    <DropdownMenuItem className="text-danger" onClick={() => void del(c.id)}><Trash2 />ลบ</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
          {shown.length === 0 && <p className="text-sm text-sub">ไม่มีคลิป</p>}
        </div>
        {owner && <Button onClick={() => nav(`/clips/new?date=${date}`)}><Plus />เพิ่มคลิป</Button>}
        {copying && <CopyDialog clip={copying} onClose={() => setCopying(null)} />}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Replace `src/pages/Calendar.tsx`.** View and date live in the URL, so Back and links from Home work.

```tsx
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addDays, addMonths, isSameMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useCategories, useClips, useMe } from '@/api/queries'
import { ClipCard } from '@/components/ClipCard'
import { DayDrawer } from '@/components/DayDrawer'
import { Button } from '@/components/ui/button'
import { dayLabel, fromIso, monthGrid, monthLabel, rangeLabel, toIso, todayIso, weekDays } from '@/lib/dates'
import type { ClipCardRow } from '@/lib/types'

const MAX_CARDS = 4

export function Calendar() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'month' ? 'month' : 'week'
  const dateIso = params.get('date') ?? todayIso()
  const date = fromIso(dateIso)
  const days = view === 'week' ? weekDays(date) : monthGrid(date)
  const { data: me } = useMe()
  const owner = me?.role === 'owner'
  const clips = useClips(toIso(days[0]), toIso(days[days.length - 1]))
  const [drawer, setDrawer] = useState<string | null>(null)

  const go = (next: { view?: string; date?: string }) => setParams({ view, date: dateIso, ...next })
  const step = (n: number) => go({ date: toIso(view === 'week' ? addDays(date, 7 * n) : addMonths(date, n)) })
  const forDay = (iso: string) => clips.data?.filter((c) => c.date === iso) ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="ก่อนหน้า" onClick={() => step(-1)}><ChevronLeft /></Button>
        <b className="text-lg">{view === 'week' ? rangeLabel(date) : monthLabel(date)}</b>
        <Button variant="outline" size="icon" aria-label="ถัดไป" onClick={() => step(1)}><ChevronRight /></Button>
        <Button variant="outline" onClick={() => go({ date: todayIso() })}>วันนี้</Button>
        <div className="flex rounded-card border border-line p-0.5">
          {(['week', 'month'] as const).map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => go({ view: v })} className={`rounded-md px-3 py-1 text-sm ${view === v ? 'bg-brand text-white' : ''}`}>
              {v === 'week' ? 'สัปดาห์' : 'เดือน'}
            </button>
          ))}
        </div>
        {owner && <Button asChild className="ml-auto"><Link to={`/clips/new?date=${dateIso}`}><Plus />เพิ่มคลิป</Link></Button>}
      </div>

      {view === 'week'
        ? <Week days={days} loading={clips.isPending} forDay={forDay} owner={owner} onOpen={setDrawer} />
        : <Month days={days} anchor={date} forDay={forDay} onPick={(iso) => go({ view: 'week', date: iso })} />}

      {drawer && <DayDrawer date={drawer} onClose={() => setDrawer(null)} />}
    </div>
  )
}

function Week(p: { days: Date[]; loading: boolean; forDay: (iso: string) => ClipCardRow[]; owner: boolean; onOpen: (iso: string) => void }) {
  const today = todayIso()
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
      {p.days.map((d) => {
        const iso = toIso(d)
        const list = p.forDay(iso)
        const isToday = iso === today
        return (
          <section key={iso} className={`flex flex-col gap-2 rounded-card p-2 md:min-h-[70vh] ${isToday ? 'border border-brand bg-today' : 'bg-surface'}`}>
            <button onClick={() => p.onOpen(iso)} className={`rounded-card py-1 text-center ${isToday ? 'bg-brand text-white' : ''}`}>
              <span className="text-xs">{dayLabel(d)}</span><br /><b className="text-xl">{d.getDate()}</b><br />
              <span className="text-xs">{list.length} คลิป</span>
            </button>
            {p.loading && <div className="h-20 rounded-card bg-grid" aria-label="กำลังโหลด" />}
            {list.slice(0, MAX_CARDS).map((c) => <ClipCard key={c.id} clip={c} />)}
            {list.length > MAX_CARDS && (
              <button onClick={() => p.onOpen(iso)} className="text-xs text-brand">ดูเพิ่มอีก {list.length - MAX_CARDS} คลิป</button>
            )}
            {p.owner && (
              <Link to={`/clips/new?date=${iso}`} className="rounded-card border border-dashed border-line py-1 text-center text-xs text-sub">+ เพิ่มคลิป</Link>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Month(p: { days: Date[]; anchor: Date; forDay: (iso: string) => ClipCardRow[]; onPick: (iso: string) => void }) {
  const { data: cats = [] } = useCategories()
  const today = todayIso()
  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-card border border-line">
      {p.days.slice(0, 7).map((d) => <div key={d.getDay()} className="border-b border-grid py-1 text-center text-xs text-sub">{dayLabel(d)}</div>)}
      {p.days.map((d) => {
        const iso = toIso(d)
        const list = p.forDay(iso)
        const inMonth = isSameMonth(d, p.anchor)
        return (
          <button key={iso} onClick={() => p.onPick(iso)} className={`flex min-h-20 flex-col gap-1 border-r border-b border-grid p-1 text-left md:min-h-28 ${iso === today ? 'bg-today' : inMonth ? '' : 'bg-surface opacity-60'}`}>
            <span className="flex justify-between text-xs"><b>{d.getDate()}</b>{list.length > 0 && <span className="hidden text-sub sm:inline">{list.length} คลิป</span>}</span>
            {cats.map((c) => {
              const n = list.filter((x) => x.category_id === c.id).length
              return n > 0 && (
                <span key={c.id} className="flex justify-between rounded px-1 text-xs font-bold text-white" style={{ background: c.color }}>
                  <span className="hidden truncate sm:inline">{c.name}</span><span>{n}</span>
                </span>
              )
            })}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Verify in the browser.** Compare to each listed node. Expected: prev/next changes the range; today jumps back; month day click opens the week view; day header opens the drawer; filter chips filter; move up/down reorders; delete shows "ลบคลิปแล้ว" and "เลิกทำ" restores within 10 s; copy lands on the chosen day. Create 5 clips on one day: "ดูเพิ่มอีก 1 คลิป" appears. Creator: no menu, no add buttons.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add calendar week and month views with day drawer"
```

---

### Task 8: Creator clip detail

**Figma:** `60:61`, submit section `102:2240`, withdraw `112:3977`, revision banner `108:21184`.

**Files:** Replace `src/pages/ClipDetail.tsx`. Stub `src/pages/ClipForm.tsx` with `export function ClipForm(_: { clipId?: string }) { return null }` until Task 9.

- [ ] **Step 1: Replace `src/pages/ClipDetail.tsx`**

```tsx
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import * as api from '@/api/index'
import { useAct, useClip, useClips, useMe, useMedia } from '@/api/queries'
import { CategoryBadge, FileTile, StatusChip, UploadDisabled } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { fromIso, fullDate } from '@/lib/dates'
import { canWithdraw, formatSize, withRounds, withdrawMinutesLeft, daysLeft } from '@/lib/media'
import { ClipForm } from './ClipForm'

export function ClipDetail() {
  const { id = '' } = useParams()
  const { data: me } = useMe()
  if (id === 'new') return me?.role === 'owner' ? <ClipForm /> : <Navigate to="/" replace />
  return me?.role === 'owner' ? <ClipForm clipId={id} /> : <CreatorDetail id={id} />
}

function NoteBox({ note }: { note: string }) {
  return (
    <section className="rounded-card border border-note-line bg-note p-3">
      <h2 className="mb-1 text-sm font-bold">หมายเหตุ</h2>
      <ul className="list-disc pl-4 text-sm">{note.split('\n').filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}</ul>
    </section>
  )
}

function CreatorDetail({ id }: { id: string }) {
  const nav = useNavigate()
  const { data: me } = useMe()
  const { data: clip, isPending } = useClip(id)
  const { data: media = [] } = useMedia(id)
  const { data: day = [] } = useClips(clip?.date ?? '', clip?.date ?? '')
  const withdraw = useAct(api.withdrawMedia)

  if (isPending) return <p className="text-sm text-sub">กำลังโหลด...</p>
  if (!clip) return <p>ไม่พบคลิป <Link to="/calendar" className="text-brand">กลับปฏิทิน</Link></p>

  const refs = media.filter((m) => m.purpose === 'reference')
  const rounds = withRounds(media.filter((m) => m.purpose === 'submission'))
  const i = day.findIndex((c) => c.id === id)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" asChild><Link to={`/calendar?date=${clip.date}`}><ChevronLeft />ปฏิทิน</Link></Button>
        <div className="flex items-center gap-2 text-xs text-sub">
          คลิป {i + 1} จาก {day.length} ของวันนี้
          <Button variant="outline" size="icon" aria-label="คลิปก่อนหน้า" disabled={i <= 0} onClick={() => nav(`/clips/${day[i - 1].id}`)}><ChevronLeft /></Button>
          <Button variant="outline" size="icon" aria-label="คลิปถัดไป" disabled={i >= day.length - 1} onClick={() => nav(`/clips/${day[i + 1].id}`)}><ChevronRight /></Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-sub">
            <CategoryBadge categoryId={clip.category_id} />{fullDate(fromIso(clip.date))}<StatusChip status={clip.status} />
          </div>
          <h1 className="text-3xl font-bold">{clip.title}</h1>
          {clip.status === 'revision' && (
            <div role="status" className="rounded-card border border-[#ffb04d] bg-[#fff0e0] p-3 text-sm">
              <b>เจ้าของขอให้แก้ไข</b><p>{clip.revision_note}</p>
            </div>
          )}
          <section className="rounded-card border border-line p-4">
            <h2 className="mb-2 text-sm font-bold text-sub">สคริปต์</h2>
            <p className="text-lg leading-loose whitespace-pre-wrap">{clip.script}</p>
          </section>
        </div>

        <div className="flex flex-col gap-3 max-lg:order-first">
          {clip.note && <NoteBox note={clip.note} />}
          <section className="rounded-card border border-line p-3">
            <h2 className="mb-2 text-sm font-bold">ไฟล์อ้างอิง {refs.length} ไฟล์</h2>
            <div className="grid grid-cols-3 gap-2">{refs.map((f) => <FileTile key={f.id} file={f} />)}</div>
          </section>
          <section className="flex flex-col gap-2 rounded-card border border-line p-3">
            <h2 className="flex justify-between text-sm font-bold">ส่งงาน<span className="text-xs font-normal text-sub">ไฟล์ที่ตัดต่อแล้ว · MP4 ≤ 2 GB</span></h2>
            <UploadDisabled label="ลากไฟล์มาวาง หรือ คลิกเพื่อเลือกไฟล์" />
            <h3 className="text-xs font-bold">ส่งแล้ว ({rounds.length} รอบ)</h3>
            {rounds.map((m) => (
              <div key={m.id} className="flex flex-col gap-2 rounded-card border border-grid p-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-today text-brand"><Play size={14} /></span>
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="mr-1 rounded bg-surface px-1 text-xs font-bold">รอบ {m.round}</span><b className="truncate">{m.file_name}</b>
                    <div className="text-xs text-sub">{formatSize(m.size_bytes)} · ลบใน {daysLeft(m.expires_at)} วัน</div>
                  </div>
                </div>
                {me && canWithdraw(m, me.id) && (
                  <Button variant="outline" className="border-danger text-danger" disabled={withdraw.isPending} onClick={() => withdraw.mutate(m.id)}>
                    ถอนไฟล์นี้ (เหลือ {withdrawMinutesLeft(m)} นาที)
                  </Button>
                )}
              </div>
            ))}
            <p className="text-xs text-sub">ถอนไฟล์ได้ภายใน 10 นาทีหลังส่ง หลังจากนั้นไฟล์จะถูกล็อก และแก้ไขได้ด้วยการส่งรอบใหม่</p>
          </section>
        </div>
      </div>
    </div>
  )
}
```

The minutes label updates on re-render only, which is fine without a timer because the API re-checks the window.

- [ ] **Step 2: Verify in the browser** as `creator@example.com`. Expected: script is large and read-only, no edit control exists, upload zone is inert, the newest submission shows "ถอนไฟล์นี้" and removes on click, older rounds have no delete, clip c2 shows the orange revision banner, previous/next moves within the day, and a bad id shows "ไม่พบคลิป". After reloading more than 10 minutes later the button is gone; `localStorage.clear()` in the console then reload reseeds.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add creator clip detail with withdraw and revision banner"
```

---

### Task 9: Owner clip form (add and edit)

**Figma:** add `74:1365`, filled `74:1459`, validation `74:1575`, draft `112:4877`, copy `74:1692`, edit `60:174`, retention warning `112:4568`.

**Files:** Replace `src/pages/ClipForm.tsx`. Stub `src/pages/Review.tsx` with `export function Review(_: { clipId: string }) { return null }` until Task 10.

- [ ] **Step 1: Replace `src/pages/ClipForm.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Copy, Trash2 } from 'lucide-react'
import * as api from '@/api/index'
import { useAct, useCategories, useClip, useDeleteClip, useMedia } from '@/api/queries'
import { CopyDialog } from '@/components/CopyDialog'
import { FileTile, UploadDisabled } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { todayIso } from '@/lib/dates'
import { daysLeft, WARN_DAYS } from '@/lib/media'
import type { ClipInput } from '@/lib/types'
import { Review } from './Review'
import { toast } from 'sonner'

const DRAFT_KEY = 'clip-draft'

function readDraft(): ClipInput | null {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
  } catch {
    return null
  }
}

export function ClipForm({ clipId }: { clipId?: string }) {
  const { data: clip, isPending } = useClip(clipId ?? '')
  if (clipId && isPending) return <p className="text-sm text-sub">กำลังโหลด...</p>
  if (clipId && !clip) return <p>ไม่พบคลิป <Link to="/calendar" className="text-brand">กลับปฏิทิน</Link></p>
  return <Form key={clipId ?? 'new'} clipId={clipId} initial={clip ?? undefined} />
}

function Form({ clipId, initial }: { clipId?: string; initial?: ClipInput }) {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const { data: cats = [] } = useCategories()
  const { data: media = [] } = useMedia(clipId ?? '')
  const [form, setForm] = useState<ClipInput>(initial ?? {
    date: params.get('date') ?? todayIso(), category_id: '', title: '', script: '', note: '',
  })
  const [titleError, setTitleError] = useState(false)
  const [draft, setDraft] = useState(() => (clipId ? null : readDraft()))
  const [draftSaved, setDraftSaved] = useState(false)
  const [copying, setCopying] = useState(false)
  const del = useDeleteClip()
  const removeFile = useAct(api.deleteMedia)
  const save = useAct((input: ClipInput) => (clipId ? api.updateClip(clipId, input) : api.createClip(input)))

  const categoryId = form.category_id || cats[0]?.id || ''
  const set = (patch: Partial<ClipInput>) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    if (clipId || draft || !(form.title || form.script || form.note)) return
    const t = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
      setDraftSaved(true)
    }, 1000)
    return () => clearTimeout(t)
  }, [form, clipId, draft])

  const submit = () => {
    if (!form.title.trim()) return setTitleError(true)
    const { date, script, note } = form
    save.mutate({ date, script, note, category_id: categoryId, title: form.title.trim() }, {
      onSuccess: (c) => {
        localStorage.removeItem(DRAFT_KEY)
        toast.success('บันทึกแล้ว')
        if (!clipId) nav(`/clips/${c.id}`, { replace: true })
      },
    })
  }

  const refs = media.filter((m) => m.purpose === 'reference')
  const expiring = media.filter((m) => daysLeft(m.expires_at) <= WARN_DAYS)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" asChild><Link to={`/calendar?date=${form.date}`}><ChevronLeft />ปฏิทิน</Link></Button>
        {draftSaved && <span className="text-xs text-sub">✓ บันทึกร่างอัตโนมัติแล้ว</span>}
        <div className="flex gap-2">
          {clipId ? (
            <>
              <Button variant="outline" onClick={() => setCopying(true)}><Copy />คัดลอกไปวันอื่น</Button>
              <Button variant="outline" className="border-danger text-danger" onClick={() => void del(clipId).then(() => nav(`/calendar?date=${form.date}`))}><Trash2 />ลบคลิป</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => nav(-1)}>ยกเลิก</Button>
          )}
          <Button onClick={submit} disabled={save.isPending}>บันทึก</Button>
        </div>
      </div>

      {draft && (
        <div className="flex items-center justify-between rounded-card border border-note-line bg-note p-3 text-sm">
          พบร่างที่ยังไม่ได้บันทึก: {draft.title || 'ไม่มีหัวข้อ'}
          <span className="flex gap-2">
            <Button variant="outline" onClick={() => { localStorage.removeItem(DRAFT_KEY); setDraft(null) }}>ทิ้งร่าง</Button>
            <Button onClick={() => { setForm(draft); setDraft(null) }}>กู้คืนร่าง</Button>
          </span>
        </div>
      )}

      {expiring.length > 0 && (
        <div role="status" className="rounded-card border border-[#ffb04d] bg-[#fff0e0] p-3 text-sm">
          มี {expiring.length} ไฟล์จะถูกลบใน {Math.min(...expiring.map((m) => daysLeft(m.expires_at)))} วัน
          <Button variant="link" disabled className="ml-2 h-auto p-0">ดาวน์โหลดทั้งหมด</Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="cat">ประเภท</Label>
              <select id="cat" value={categoryId} onChange={(e) => set({ category_id: e.target.value })} className="h-9 rounded-md border border-line bg-white px-2 text-sm">
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="date">วัน</Label>
              <Input id="date" type="date" value={form.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="title">หัวข้อ</Label>
            <Input id="title" aria-invalid={titleError} value={form.title} className="font-bold" onChange={(e) => { set({ title: e.target.value }); setTitleError(false) }} />
            {titleError && <p role="alert" className="text-xs text-danger">กรุณากรอกหัวข้อ</p>}
          </div>
          <div className="grid gap-1">
            <Label htmlFor="script">สคริปต์</Label>
            <Textarea id="script" rows={clipId ? 10 : 18} value={form.script} onChange={(e) => set({ script: e.target.value })} />
          </div>
          {clipId && <Review clipId={clipId} />}
        </div>

        <div className="flex flex-col gap-3">
          <section className="rounded-card border border-note-line bg-note p-3">
            <Label htmlFor="note" className="mb-1">หมายเหตุ</Label>
            <Textarea id="note" rows={5} placeholder="หนึ่งบรรทัดต่อหนึ่งข้อ" className="bg-white" value={form.note} onChange={(e) => set({ note: e.target.value })} />
          </section>
          <section className="flex flex-col gap-2 rounded-card border border-line p-3">
            <h2 className="text-sm font-bold">ไฟล์อ้างอิง ({refs.length})</h2>
            <div className="grid grid-cols-2 gap-2">{refs.map((f) => <FileTile key={f.id} file={f} onDelete={() => removeFile.mutate(f.id)} />)}</div>
            <UploadDisabled label="ลากรูปมาวางหรือคลิกเพื่ออัปโหลด" />
          </section>
        </div>
      </div>

      {copying && clipId && <CopyDialog clip={{ id: clipId, title: form.title, date: form.date }} onClose={() => setCopying(false)} />}
    </div>
  )
}
```

`useClip('')` runs on `/clips/new` and returns `null`, which is harmless.

- [ ] **Step 2: Verify in the browser** as owner. Expected: empty save shows "กรุณากรอกหัวข้อ"; a valid save lands on the clip; typing then reloading `/clips/new` shows the restore banner and "กู้คืนร่าง" fills the form; saving clears the draft; changing the date moves the clip; delete returns to the calendar with undo; file × removes a tile; clip c1 shows the expiry warning. "ดาวน์โหลดทั้งหมด" is disabled because no real files exist.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add owner clip form with draft autosave"
```

---

### Task 10: Owner review section

**Figma:** `103:2528`, approve/request changes `108:20979`.

**Files:** Replace `src/pages/Review.tsx`.

- [ ] **Step 1: Replace `src/pages/Review.tsx`**

```tsx
import { useState } from 'react'
import { Play } from 'lucide-react'
import * as api from '@/api/index'
import { useAct, useClip, useMedia } from '@/api/queries'
import { StatusChip } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { daysLeft, formatSize, isPlayable, withRounds } from '@/lib/media'

export function Review({ clipId }: { clipId: string }) {
  const { data: clip } = useClip(clipId)
  const { data: media = [] } = useMedia(clipId)
  const rounds = withRounds(media.filter((m) => m.purpose === 'submission'))
  const [selected, setSelected] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const remove = useAct(api.deleteMedia)
  const review = useAct(({ status, note }: { status: 'approved' | 'revision'; note?: string }) => api.reviewClip(clipId, status, note))
  const current = rounds.find((m) => m.id === selected) ?? rounds[0]

  if (!clip) return null
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line p-3">
      <h2 className="flex justify-between text-sm font-bold">งานที่ครีเอเตอร์ส่ง ({rounds.length} ไฟล์)</h2>
      {rounds.length === 0 ? <p className="text-sm text-sub">ยังไม่มีไฟล์ส่งงาน</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex aspect-video flex-col justify-between rounded-card bg-[#1e1e1e] p-3 text-sm text-white">
            <b>รอบ {current.round} · {current.file_name}</b>
            <span className="flex flex-col items-center gap-1"><Play />วิดีโอจริงจะเล่นได้หลังเชื่อมต่อ R2</span>
            <span />
          </div>
          <div className="flex flex-col gap-2">
            {rounds.map((m) => (
              <div key={m.id} className={`flex items-center gap-2 rounded-card border p-2 text-sm ${m.id === current.id ? 'border-brand bg-today' : 'border-grid'}`}>
                <span className="rounded bg-white px-1 text-xs font-bold">รอบ {m.round}</span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{m.file_name}</b>
                  <span className={`text-xs ${isPlayable(m.mime) ? 'text-sub' : 'text-danger'}`}>
                    {isPlayable(m.mime) ? `${formatSize(m.size_bytes)} · ลบใน ${daysLeft(m.expires_at)} วัน` : 'ProRes · เล่นในเบราว์เซอร์ไม่ได้ ดาวน์โหลดแทน'}
                  </span>
                </div>
                {isPlayable(m.mime)
                  ? <button className="text-xs text-brand" onClick={() => setSelected(m.id)}>{m.id === current.id ? 'กำลังเล่น' : 'เล่น'}</button>
                  : <button disabled className="text-xs text-sub">ดาวน์โหลด</button>}
                <button className="text-xs text-danger" onClick={() => remove.mutate(m.id)}>ลบ</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs">สถานะ: <StatusChip status={clip.status} /></span>
        <span className="flex gap-2">
          <Button variant="outline" className="border-[#ff9500] text-[#b35c00]" disabled={review.isPending} onClick={() => review.mutate({ status: 'revision', note: reason }, { onSuccess: () => setReason('') })}>ขอแก้ไข</Button>
          <Button className="bg-[#34c759] text-white hover:bg-[#34c759]/90" disabled={review.isPending || rounds.length === 0} onClick={() => review.mutate({ status: 'approved' })}>อนุมัติ</Button>
        </span>
      </div>
      <Input aria-label="เหตุผลที่ขอแก้ไข" placeholder="เหตุผลที่ขอแก้ไข (ครีเอเตอร์จะเห็นข้อความนี้)" value={reason} onChange={(e) => setReason(e.target.value)} />
    </section>
  )
}
```

- [ ] **Step 2: Verify in the browser.** Expected on c1: three rounds, selecting changes the placeholder, the `.mov` row shows the ProRes warning with a disabled download, delete removes a row, empty reason toasts "กรุณาระบุเหตุผลที่ขอแก้ไข", a reason sets แก้ไข and the creator sees the banner, อนุมัติ sets ผ่าน and clears it.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add owner submission review and status actions"
```

---

### Task 11: Search

**Figma:** results `112:2686`, no results `112:3260`.

**Files:** Replace `src/pages/Search.tsx`.

- [ ] **Step 1: Replace `src/pages/Search.tsx`**

```tsx
import { Link, useSearchParams } from 'react-router-dom'
import { useSearch } from '@/api/queries'
import { CategoryBadge } from '@/components/bits'
import { Input } from '@/components/ui/input'
import { dayLabel, fromIso, shortDate } from '@/lib/dates'
import { snippet } from '@/lib/search'

export function Search() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const { data = [], isFetching } = useSearch(q)

  return (
    <div className="flex flex-col gap-3">
      {/* The sidebar is hidden on phones, so this input is the only search box there. */}
      <Input className="md:hidden" aria-label="ค้นหาคลิป" placeholder="ค้นหาคลิป..." defaultValue={q} onKeyDown={(e) => e.key === 'Enter' && setParams({ q: e.currentTarget.value })} />
      {q && <h1 className="text-lg font-bold">ผลการค้นหา “{q}” <span className="text-sm font-normal text-sub">{data.length} คลิป</span></h1>}
      {data.map((c) => {
        const hay = [c.script, c.note, c.title].find((t) => t.toLowerCase().includes(q.trim().toLowerCase())) ?? c.script
        const s = snippet(hay, q)
        const d = fromIso(c.date)
        return (
          <Link key={c.id} to={`/clips/${c.id}`} className="flex flex-col gap-1 rounded-card border border-line p-3 hover:bg-surface">
            <div className="flex justify-between text-xs text-sub"><CategoryBadge categoryId={c.category_id} />{dayLabel(d)} {shortDate(d)}</div>
            <b>{c.title}</b>
            <p className="text-xs text-sub">{s.before}<mark className="bg-note-line text-ink">{s.match}</mark>{s.after}</p>
          </Link>
        )
      })}
      {q && !isFetching && data.length === 0 && (
        <div className="py-16 text-center">
          <p className="font-bold">ไม่พบคลิปที่ตรงกับ “{q}”</p>
          <p className="text-sm text-sub">ลองคำอื่น หรือเช็กการสะกด</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify in the browser.** Expected: searching "Tissot" lists matches with highlight; a nonsense word shows the empty state; after deleting a clip it stops appearing; Enter works in the mobile input at 375 px.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add clip search page"
```

---

### Task 12: Categories

**Figma:** the Thai-named set: list `87:1665`, add `87:1749`, delete `87:1859`, empty `87:1959`. Delete the duplicate English set in Figma only if the user asks.

**Files:** Replace `src/pages/Categories.tsx`.

- [ ] **Step 1: Replace `src/pages/Categories.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import * as api from '@/api/index'
import { useAct, useCategories, useCategoryCounts } from '@/api/queries'
import { ConfirmDialog } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Category } from '@/lib/types'

type Editing = Category | 'new' | null

export function Categories() {
  const { data: cats = [], isPending } = useCategories()
  const { data: counts = {} } = useCategoryCounts()
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const remove = useAct(api.deleteCategory)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">ประเภทคลิป</h1>
        <Button onClick={() => setEditing('new')}><Plus />เพิ่มประเภท</Button>
      </div>
      {!isPending && cats.length === 0 && <p className="py-16 text-center text-sub">ยังไม่มีประเภทคลิป</p>}
      {cats.length > 0 && (
        <div className="overflow-hidden rounded-card border border-line">
          <div className="hidden grid-cols-[40px_1fr_120px_140px] bg-surface p-3 text-xs text-sub md:grid">
            <span>สี</span><span>ชื่อประเภท</span><span>จำนวนคลิป</span><span className="text-right">การจัดการ</span>
          </div>
          {cats.map((c) => (
            <div key={c.id} className="grid grid-cols-[32px_1fr_auto] items-center gap-y-1 border-t border-grid p-3 md:grid-cols-[40px_1fr_120px_140px]">
              <span className="size-3 rounded-full" style={{ background: c.color }} />
              <b className="text-sm">{c.name}</b>
              <span className="text-sm max-md:hidden">{counts[c.id] ?? 0}</span>
              <span className="flex justify-end gap-1">
                <Button variant="ghost" className="size-11 md:size-auto" aria-label={`แก้ไข ${c.name}`} onClick={() => setEditing(c)}><Pencil /><span className="max-md:hidden">แก้ไข</span></Button>
                <Button variant="ghost" className="size-11 text-danger md:size-auto" aria-label={`ลบ ${c.name}`} onClick={() => setDeleting(c)}><Trash2 /><span className="max-md:hidden">ลบ</span></Button>
              </span>
            </div>
          ))}
        </div>
      )}
      {editing && <CategoryDialog editing={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!deleting} title={`ลบประเภท “${deleting?.name}”?`} body="ลบได้เฉพาะประเภทที่ไม่มีคลิปอยู่" confirm="ลบ"
        onConfirm={() => deleting && remove.mutate(deleting.id)} onClose={() => setDeleting(null)} />
    </div>
  )
}

function CategoryDialog({ editing, onClose }: { editing: Category | 'new'; onClose: () => void }) {
  const current = editing === 'new' ? null : editing
  const save = useAct(({ name, color }: { name: string; color: string }) =>
    current ? api.updateCategory(current.id, { name, color }) : api.createCategory(name, color).then(() => undefined))

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    save.mutate({ name: String(f.get('name')).trim(), color: String(f.get('color')) }, { onSuccess: onClose })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{current ? 'แก้ไขประเภท' : 'เพิ่มประเภท'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-1"><Label htmlFor="name">ชื่อประเภท</Label><Input id="name" name="name" required defaultValue={current?.name} /></div>
          <div className="grid gap-1"><Label htmlFor="color">สี</Label><input id="color" name="color" type="color" defaultValue={current?.color ?? '#6155f5'} className="h-9 w-16" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={save.isPending}>บันทึก</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify in the browser.** Compare to `87:1665`, `87:1749`, `87:1859`, `87:1959` (replace the native color input with swatches if the frame shows them). Expected: add, edit and delete work; deleting รีวิว toasts "ลบไม่ได้ ยังมีคลิปในประเภทนี้"; a new category appears in the clip form and calendar month chips; the creator is redirected away from `/categories`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add category management"
```

---

### Task 13: Users

**Figma:** list `90:1896`, create `90:1990`, success `90:2097`, delete `90:2215`.

**Files:** Replace `src/pages/Users.tsx`.

- [ ] **Step 1: Replace `src/pages/Users.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { KeyRound, Plus, Trash2 } from 'lucide-react'
import * as api from '@/api/index'
import { useAct, useUsers } from '@/api/queries'
import { ConfirmDialog } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Profile } from '@/lib/types'

export function Users() {
  const { data: users = [] } = useUsers()
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Profile | null>(null)
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null)
  const reset = useAct(api.resetPassword)
  const remove = useAct(api.deleteUser)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">ผู้ใช้งาน</h1>
        <Button onClick={() => setCreating(true)}><Plus />สร้างบัญชีครีเอเตอร์</Button>
      </div>
      <div className="overflow-hidden rounded-card border border-line">
        {users.map((u) => (
          <div key={u.id} className="grid items-center gap-2 border-t border-grid p-3 first:border-t-0 md:grid-cols-[1fr_1.5fr_100px_120px_auto]">
            <b className="text-sm">{u.display_name}</b>
            <span className="truncate text-sm text-sub">{u.email}</span>
            <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-bold ${u.role === 'owner' ? 'bg-today text-[#0066cc]' : 'bg-surface text-sub'}`}>{u.role === 'owner' ? 'เจ้าของ' : 'ครีเอเตอร์'}</span>
            <span className="text-sm text-sub">{format(parseISO(u.created_at), 'd MMM yyyy', { locale: th })}</span>
            <span className="flex gap-1">
              <Button variant="ghost" className="min-h-11 md:min-h-0" onClick={() => reset.mutate(u.id, { onSuccess: (password) => setTemp({ email: u.email, password }) })}><KeyRound />รีเซ็ตรหัสผ่าน</Button>
              <Button variant="ghost" className="min-h-11 text-danger md:min-h-0" disabled={u.role === 'owner'} onClick={() => setDeleting(u)}><Trash2 />ลบ</Button>
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-sub">เฉพาะเจ้าของช่องเท่านั้นที่สร้างและจัดการบัญชีผู้ใช้งานได้</p>

      {creating && <CreateDialog onClose={() => setCreating(false)} onDone={(email, password) => { setCreating(false); setTemp({ email, password }) }} />}

      <Dialog open={!!temp} onOpenChange={(o) => !o && setTemp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>รหัสผ่านชั่วคราว</DialogTitle>
            <DialogDescription>รหัสนี้จะไม่แสดงอีก คัดลอกเก็บไว้ก่อนปิด</DialogDescription>
          </DialogHeader>
          <p className="text-sm">{temp?.email}</p>
          <code className="rounded-card bg-surface p-3 text-lg">{temp?.password}</code>
          <DialogFooter>
            <Button variant="outline" onClick={() => void navigator.clipboard.writeText(temp?.password ?? '')}>คัดลอก</Button>
            <Button onClick={() => setTemp(null)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleting} title={`ลบบัญชี ${deleting?.display_name}?`} body="ผู้ใช้นี้จะเข้าสู่ระบบไม่ได้อีก" confirm="ลบบัญชี"
        onConfirm={() => deleting && remove.mutate(deleting.id)} onClose={() => setDeleting(null)} />
    </div>
  )
}

function CreateDialog({ onClose, onDone }: { onClose: () => void; onDone: (email: string, password: string) => void }) {
  const create = useAct(({ name, email }: { name: string; email: string }) => api.createCreator(name, email))
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    create.mutate({ name: String(f.get('name')).trim(), email: String(f.get('email')) }, {
      onSuccess: (r) => onDone(r.user.email, r.tempPassword),
    })
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>สร้างบัญชีครีเอเตอร์</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-1"><Label htmlFor="name">ชื่อ</Label><Input id="name" name="name" required /></div>
          <div className="grid gap-1"><Label htmlFor="email">อีเมล</Label><Input id="email" name="email" type="email" required /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={create.isPending}>สร้างบัญชี</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify in the browser.** Expected: create shows the temp password once, a duplicate email toasts an error, logging in with the temp password works, reset issues a new one, the owner's delete is disabled, and a deleted user cannot log in.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add user management"
```

---

### Task 14: Error handling for failed reads

**Files:** Modify `src/main.tsx`.

- [ ] **Step 1: Toast query failures globally,** so a failed read does not look like an empty list. Replace the `new QueryClient()` in `src/main.tsx`:

```tsx
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast, Toaster } from 'sonner'

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (e) => toast.error(e.message) }),
  defaultOptions: { queries: { retry: false } },
})
```

Pass `client={queryClient}` to the provider.

- [ ] **Step 2: Verify.** In the browser console run `localStorage.removeItem('fake-session')`, then trigger a refetch by navigating. Expected: a "กรุณาเข้าสู่ระบบ" toast, then a redirect to login on reload.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: surface query errors as toasts"
```

---

### Task 15: Responsive pass against Tablet and Mobile frames

**Figma:** ask the user to open page "Tablet" in Figma, then export: Home `105:3986`, week `105:4209`, month `105:4586`, clip `105:4458`. Then page "Mobile": week with FAB `105:3208`, menu `105:3307`, day sheet `105:3860`, clip menu `112:20909`, categories `105:3426`, users `105:3538`, clip edit `105:5252`.

**Files:** Modify `src/pages/Calendar.tsx`, and whichever pages the comparison flags.

- [ ] **Step 1: Add the mobile FAB.** In `src/pages/Calendar.tsx`, give the toolbar add button `max-md:hidden`, and after the `Month`/`Week` block add:

```tsx
{owner && (
  <Link to={`/clips/new?date=${dateIso}`} aria-label="เพิ่มคลิป" className="fixed right-4 bottom-4 flex size-14 items-center justify-center rounded-full bg-brand text-white md:hidden">
    <Plus />
  </Link>
)}
```

- [ ] **Step 2: Add one-day-at-a-time if the frame needs it.** `105:3208` decides between the vertical stack this plan already renders and a single-day view. If the frame shows a single day, render `days.filter((d) => toIso(d) === dateIso)` below `md`, by passing a second `Week` wrapped in `md:hidden` and the 7-column one in `hidden md:block`. Add day-chip buttons calling `go({ date: iso })`.

- [ ] **Step 3: Compare every page at 375, 768, 1280 and 1920 px** using `resize_window`. Expected: no horizontal page scroll, touch targets at least 44 px on phone, sheet and dialogs fit the viewport. Fix with Tailwind breakpoints only. Reset with preset `desktop` afterwards.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: match tablet and mobile frames"
```

---

### Task 16: Final check and docs

**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1: Run everything**

```bash
npm test
npm run lint
npm run build
```

Expected: all exit 0.

- [ ] **Step 2: Walk the whole flow in the browser.** Owner: log in, add a clip, edit, copy, move, delete and undo, review c1, add a category, create a creator. Creator: log in, read the brief, see the revision banner, withdraw. Search as both. Check the console has no errors.

- [ ] **Step 3: Update `CLAUDE.md`.** Replace the "State of the repo" section with:

```markdown
## State of the repo

Vite + React + TS app. The frontend runs on a browser-only fake backend in `src/api/fake/`, seeded into localStorage; Buddy's Supabase backend is not connected yet. Upload is disabled until R2 exists, so all media is seeded rows with no real file.

Commands: `npm run dev`, `npm test` (Vitest, logic only), `npm run lint`, `npm run build`.

Fake logins: `owner@example.com` / `owner1234`, `creator@example.com` / `creator1234`. Run `localStorage.clear()` in the console to reseed.

All data access goes through `src/api/index.ts`. Screens must not import `src/api/fake/` directly. To connect Supabase, replace `src/api/index.ts` and delete `src/api/fake/`.
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: record repo state and commands"
```

---

## Handoff to Buddy (what the fake layer assumes)

Columns and rules the screens rely on that are not in the spec yet:

- `categories.color`
- `clips.status`, `clips.revision_note`, `clips.deleted_at`
- `clip_media.file_name` (the spec has only `r2_key`)
- A way for the owner's user page to read each user's email and created date
- Password reset by the owner returning a temporary password
- Copying a clip shares reference files: decide whether the copy points at the same `r2_key`, since deleting one must not break the other
- Category delete is refused while clips use it; confirm that matches the FK rule
- RLS withdraw exception (creator, own submission, within 10 minutes) and full-text search, both already agreed

## Later plans

1. Connect Supabase: auth, data, generated types, Edge Functions.
2. Upload and playback: Uppy, presigned R2, `media-view`, upload error states (`112:3691`, `112:3834`), download-all, real video player, image lightbox.
3. Polish: dark mode, animation, drag reorder.
4. Notifications, if the client confirms.
