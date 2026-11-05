# UX Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every finding from the 2026-11-05 `/ux` audit in the React app, then bring Figma and Buddy's backend spec in line with the result.

**Architecture:** All data access stays behind `web/src/api/index.ts`; screens only use hooks from `web/src/api/queries.ts`. New pure logic goes in `web/src/lib/` with Vitest tests. Screens are checked in the browser, because Vitest covers logic and the fake API only. This plan does not edit `docs/system-design.md`; Buddy owns it, so Part C is a list to send them.

**Tech Stack:** React, Vite, TypeScript, Tailwind v4, shadcn/ui on @base-ui/react (no `asChild`; use `render` and `nativeButton={false}`), TanStack Query, React Router 7 with `BrowserRouter`, date-fns, sonner, Vitest, oxlint.

**Commands:** run from `web/`: `npm test`, `npm run lint`, `npm run build`.

**Commit trailer:** end every commit message with:
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

**UI language:** Thai. Keep the Thai strings in this plan exactly as written.

---

## Decisions this plan assumes

The first three were offered in the audit and have not been answered yet. The plan uses the recommended option. If the user picks another one, change only the task listed.

| # | Decision | Assumed | If it changes |
|---|---|---|---|
| D1 | Unsaved edits | Per-clip autosaved draft | Leave-page prompt needs a data router migration: rewrite Task 4 |
| D2 | Attention surface | `งานของฉัน` block on Home | Inbox page: move the Task 9 block to a new route. Bell or LINE push: needs a `notifications` table, out of scope here |
| D3 | Tablet week | One-day view below `xl` (1280 px) | Keep 7 columns: skip Task 10 Step 3 and Figma Task F6 |
| D4 | Reference delete | Confirm dialog, **not** the undo toast the audit suggested | Undo needs `clip_media.deleted_at` and a purge job. The confirm reuses `ConfirmDialog` and changes no schema |
| D5 | Unresolved draft | The form is locked until the owner picks `กู้คืนร่าง` or `ทิ้งร่าง` | This closes the draft-loss path without storing several drafts |
| D6 | Status and notifications | Status stays in, as the fake-layer plan decided. If the client declines status, drop Tasks 8 and 9's status parts | Spec §12 still lists status as open |

---

## Finding map

Severity: 4 blocker, 3 major, 2 minor. "Figma" and "Spec" answer whether that fix needs a change there.

| ID | Sev | Finding | Task | Figma | Spec |
|---|---|---|---|---|---|
| B1 | 4 | Edits to an existing clip vanish | 4 | No (reuses restore banner `112:4877`) | No |
| B2 | 4 | Reference `×` deletes instantly | 5 | No (reuses delete-confirm pattern) | No |
| B3 | 4 | No search input on tablet | 11 | No (`112:2973` exists) | No |
| M1 | 3 | Script buried on phone | 7 | **Yes** F2 | No |
| M2 | 3 | Nothing shows what needs attention | 3, 9 | **Yes** F3 | Depends on `status` being confirmed |
| M3 | 3 | Draft loss | 4 | No | No |
| M4 | 3 | Slow weekly entry, no owner prev/next | 6 | **Yes** F4 | No |
| M5 | 3 | Review flow backwards | 3, 8 | **Yes** F5 | No |
| M6 | 3 | `แก้ไขล่าสุด` is wrong | 2 | No | **Yes** C1 |
| M7 | 3 | Brand colour contrast | 1 | **Yes** F1 | No |
| M8 | 3 | Account dead-ends | 3, 12 | **Yes** F7 | **Yes** C2, C3 |
| M9 | 3 | Mobile owner has no day tools | 10 | Small: entry button F8 | No |
| M10 | 3 | Expiry warning hidden | 3, 5, 9 | **Yes** F3 | No schema; C4 |
| m1 | 2 | `แก้ไข` overloaded | 11 | **Yes** F8 | No |
| m2 | 2 | Month chips colour-only on phone | 10 | **Yes** F8 | No |
| m3 | 2 | Tablet week cards too narrow | 10 | **Yes** F6 | No |
| m4 | 2 | Phone Home week strip too long | 9 | Check F8 | No |
| m5 | 2 | Category delete and default colour | 13 | **Yes** F8 | No |
| m6 | 2 | Unknown URL is blank | 11 | **Yes** F8 | No |
| m7 | 2 | Tap targets, delete next to save | 6, 10 | **Yes** F4 | No |
| m8 | 2 | No real back, dead header buttons | 6, 11 | Label only F8 | No |

---

## Execution order and models

Run Part A in order; tasks share files, so do not run them in parallel. One writer at a time. Part B and Part C can start after the user answers D1 to D6. Part B needs no code. Part C is a message for Buddy, sent by the user.

| Task | Model | Why |
|---|---|---|
| 1 Contrast | Haiku | Mechanical |
| 2 `brief_updated_at` | Sonnet | Data shape and test updates |
| 3 New API functions | Sonnet | Logic and tests |
| 4 Drafts | Sonnet | Subtle state |
| 5 Reference delete, expiry flag | Haiku | Small, code given |
| 6 Form bar, pager, back | Sonnet | Several files |
| 7 Creator detail order | Haiku | Small, code given |
| 8 Review flow | Sonnet | Rewrites a component |
| 9 Home | Sonnet | Several sections |
| 10 Calendar | Sonnet | Breakpoint logic |
| 11 Search, 404, shell, labels | Haiku | Small, code given |
| 12 Account | Sonnet | New dialogs |
| 13 Categories | Haiku | Small, code given |
| 14 Docs and full check | Sonnet | Browser walk-through |
| F1 to F8 Figma | Sonnet | Needs judgement on layouts |

Haiku tasks: if a snippet's "replace this" text does not match the file, stop and report; do not improvise.

---

## File structure

```
web/src/
  lib/color.ts            NEW contrast, readableOn, nextColor
  lib/draft.ts            NEW clip draft storage and comparison
  lib/attention.ts        NEW which clips need attention, per role
  lib/media.ts            add expiresBeforeClip
  lib/status.ts           new labels
  lib/types.ts            add brief_updated_at
  api/fake/db.ts          key bump to fake-db-v2
  api/fake/seed.ts        add brief_updated_at
  api/index.ts            brief stamp, restoreReview, listAttention, listExpiring, changePassword
  api/queries.ts          useAttention, useExpiring
  components/BackButton.tsx          NEW
  components/ClipPager.tsx           NEW
  components/ChangePasswordDialog.tsx NEW
  pages/NotFound.tsx      NEW
```

---

# Part A: Code

### Task 1: Contrast tokens and readable text on category colours (M7)

**Files:**
- Create: `web/src/lib/color.ts`
- Modify: `web/src/index.css`, `web/src/components/bits.tsx`, `web/src/pages/Home.tsx`, `web/src/pages/Calendar.tsx`, `web/src/pages/Review.tsx`, any other file the sed in Step 5 touches
- Test: `web/src/lib/lib.test.ts`

- [ ] **Step 1: Write the failing test.** Add to the imports and the end of `web/src/lib/lib.test.ts`:

```ts
import { contrast, nextColor, readableOn } from './color'

describe('color', () => {
  it('measures contrast', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 0)
  })
  it('picks the readable text colour', () => {
    expect(readableOn('#34c759')).toBe('#1e1e1e')
    expect(readableOn('#6155f5')).toBe('#ffffff')
  })
  it('offers the first unused colour', () => {
    expect(nextColor(['#6155f5', '#34c759'])).toBe('#ff9500')
    expect(nextColor(['#6155F5'])).toBe('#34c759')
  })
})
```

- [ ] **Step 2: Run it.** `npm test` — Expected: FAIL, cannot resolve `./color`.

- [ ] **Step 3: Create `web/src/lib/color.ts`.**

```ts
const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Owners pick any category colour, so text colour is computed, never assumed.
export const readableOn = (bg: string) =>
  contrast(bg, '#ffffff') >= contrast(bg, '#1e1e1e') ? '#ffffff' : '#1e1e1e'

const PALETTE = ['#6155f5', '#34c759', '#ff9500', '#ff2d55', '#00a3bf', '#8e5a2b', '#5f5f5f']

export const nextColor = (used: string[]) => {
  const taken = used.map((c) => c.toLowerCase())
  return PALETTE.find((c) => !taken.includes(c)) ?? PALETTE[0]
}
```

- [ ] **Step 4: Run it.** `npm test` — Expected: PASS.

- [ ] **Step 5: Replace the failing brand and danger colours everywhere.** Run from `web/`:

```bash
grep -rlE "#0088ff|#ff383c" src | xargs sed -i -e "s/#0088ff/#0066cc/gI" -e "s/#ff383c/#d70015/gI"
```

New values: brand `#0066cc` (5.57:1 on white), danger `#d70015` (5.38:1 on white).

- [ ] **Step 6: Fix category colour text.** In `web/src/components/bits.tsx`, add `import { readableOn } from '@/lib/color'` and replace the `CategoryBadge` return:

```tsx
return (
  <span className="inline-block rounded-md px-2 py-0.5 text-xs font-bold" style={{ background: cat.color, color: readableOn(cat.color) }}>
    {cat.name}
  </span>
)
```

- [ ] **Step 7: Fix the Home strip bars.** In `web/src/pages/Home.tsx`, add the same import, then replace the bar `<span>`:

```tsx
{list.slice(0, 3).map((c) => {
  const bg = color(c.category_id) ?? '#5f5f5f'
  return <span key={c.id} className="truncate rounded px-1 text-xs font-bold" style={{ background: bg, color: readableOn(bg) }}>{c.title}</span>
})}
```

- [ ] **Step 8: Fix the month chips.** In `web/src/pages/Calendar.tsx`, add the same import. In `Month`, replace the chip's opening tag:

```tsx
<span key={c.id} className="flex justify-between rounded px-1 text-xs font-bold" style={{ background: c.color, color: readableOn(c.color) }}>
```

- [ ] **Step 9: Fix the approve button.** In `web/src/pages/Review.tsx`, replace `bg-[#34c759] text-white hover:bg-[#34c759]/90` with `bg-[#1a7f3c] text-white hover:bg-[#1a7f3c]/90`.

- [ ] **Step 10: Verify and commit.**

```bash
npm test && npm run lint && npm run build
git add -A web/src
git commit -m "fix: meet contrast minimums for brand, danger and category colours"
```

Expected: tests pass, lint clean, build succeeds.

---

### Task 2: Track brief edits separately (M6)

**Files:**
- Modify: `web/src/lib/types.ts`, `web/src/api/fake/db.ts`, `web/src/api/fake/seed.ts`, `web/src/api/index.ts`
- Test: `web/src/api/api.test.ts`

- [ ] **Step 1: Write the failing test.** Add to `web/src/api/api.test.ts`, and change the existing check at line 203 from `updated_at` to `brief_updated_at`:

```ts
describe('brief_updated_at', () => {
  const later = () => vi.setSystemTime(new Date(2026, 9, 29, 12))
  it('moves on a real brief change', async () => {
    await asOwner()
    const before = (await api.getClip('c1'))!.brief_updated_at
    later()
    await api.updateClip('c1', { script: 'ใหม่' })
    expect((await api.getClip('c1'))!.brief_updated_at).not.toBe(before)
  })
  it('stays put on a save with no change', async () => {
    await asOwner()
    const c = (await api.getClip('c1'))!
    later()
    await api.updateClip('c1', { title: c.title, script: c.script, note: c.note, date: c.date, category_id: c.category_id })
    expect((await api.getClip('c1'))!.brief_updated_at).toBe(c.brief_updated_at)
  })
  it('stays put on a review', async () => {
    await asOwner()
    const before = (await api.getClip('c1'))!.brief_updated_at
    later()
    await api.reviewClip('c1', 'approved')
    expect((await api.getClip('c1'))!.brief_updated_at).toBe(before)
  })
})
```

- [ ] **Step 2: Run it.** `npm test` — Expected: FAIL.

- [ ] **Step 3: Add the field.** In `web/src/lib/types.ts`, inside `Clip`, after `updated_at: string`:

```ts
  brief_updated_at: string // assumption: not in spec, see plan 2026-11-05 Part C
```

- [ ] **Step 4: Bump the store key.** Old stored rows have no `brief_updated_at`, and sorting them would crash. In `web/src/api/fake/db.ts`:

```ts
const KEY = 'fake-db-v2'
```

- [ ] **Step 5: Seed it.** In `web/src/api/fake/seed.ts`, replace the `clip` helper:

```ts
const clip = (id: string, date: string, position: number, category_id: string, title: string, over: Partial<Clip> = {}): Clip => {
  const at = subMinutes(now, 20 + position * 90).toISOString()
  return {
    id, date, position, category_id, title, script: SCRIPT, note: NOTE, created_by: 'u-owner',
    updated_at: at, brief_updated_at: at,
    status: 'todo', revision_note: '', deleted_at: null, ...over,
  }
}
```

- [ ] **Step 6: Stamp it in the API.** In `web/src/api/index.ts`:

In `listRecent`, sort by the new field:

```ts
return out(live().sort((a, b) => b.brief_updated_at.localeCompare(a.brief_updated_at)).slice(0, limit))
```

In `createClip` and `copyClip`, replace `updated_at: stamp(),` with `updated_at: stamp(), brief_updated_at: stamp(),`.

In `updateClip`, replace the last four statements before `save()` with:

```ts
const c = clipOf(id)
const changes = Object.fromEntries(EDITABLE.filter((k) => patch[k] !== undefined).map((k) => [k, patch[k]]))
const briefChanged = EDITABLE.some((k) => patch[k] !== undefined && patch[k] !== c[k])
if (patch.date && patch.date !== c.date) c.position = nextPosition(patch.date)
Object.assign(c, changes, { updated_at: stamp() }, briefChanged ? { brief_updated_at: stamp() } : {})
```

Leave `reviewClip` as it is: it stamps `updated_at` only.

- [ ] **Step 7: Show it on Home.** In `web/src/pages/Home.tsx`, replace `parseISO(c.updated_at)` with `parseISO(c.brief_updated_at)`.

- [ ] **Step 8: Verify and commit.** If `tsc` reports a `Clip` fixture missing the field, add `brief_updated_at` to that fixture.

```bash
npm test && npm run lint && npm run build
git add -A web/src
git commit -m "fix: recent edits track brief changes only"
```

---

### Task 3: New API functions (M2, M5, M8, M10)

**Files:**
- Create: `web/src/lib/attention.ts`
- Modify: `web/src/lib/media.ts`, `web/src/api/index.ts`, `web/src/api/queries.ts`
- Test: `web/src/lib/lib.test.ts`, `web/src/api/api.test.ts`

- [ ] **Step 1: Write the failing tests.** Add to `web/src/lib/lib.test.ts`:

```ts
import { attentionOf } from './attention'
import { expiresBeforeClip } from './media'

describe('attentionOf', () => {
  const today = '2026-10-29'
  it('sends submitted work to the owner', () => {
    expect(attentionOf({ status: 'submitted', date: today }, 'owner', today)).toBe('review')
    expect(attentionOf({ status: 'todo', date: '2026-10-01' }, 'owner', today)).toBeNull()
  })
  it('sends revisions and overdue work to the creator', () => {
    expect(attentionOf({ status: 'revision', date: '2026-11-20' }, 'creator', today)).toBe('revision')
    expect(attentionOf({ status: 'todo', date: '2026-10-28' }, 'creator', today)).toBe('overdue')
    expect(attentionOf({ status: 'todo', date: today }, 'creator', today)).toBeNull()
    expect(attentionOf({ status: 'approved', date: '2026-10-01' }, 'creator', today)).toBeNull()
  })
})

describe('expiresBeforeClip', () => {
  it('compares the expiry day with the clip day', () => {
    expect(expiresBeforeClip('2026-11-01T10:00:00.000Z', '2026-11-05')).toBe(true)
    expect(expiresBeforeClip('2026-11-05T10:00:00.000Z', '2026-11-05')).toBe(false)
  })
})
```

Add to `web/src/api/api.test.ts`:

```ts
describe('attention', () => {
  it('lists submitted clips for the owner', async () => {
    await asOwner()
    expect((await api.listAttention()).map((c) => [c.id, c.attention])).toEqual([['c1', 'review']])
  })
  it('lists revisions first, then overdue, for the creator', async () => {
    await asCreator()
    expect((await api.listAttention()).map((c) => [c.id, c.attention])).toEqual([
      ['c2', 'revision'], ['c4', 'overdue'], ['c5', 'overdue'],
    ])
  })
})

describe('restoreReview', () => {
  it('puts back the earlier status and note', async () => {
    await asOwner()
    await api.reviewClip('c2', 'approved')
    await api.restoreReview('c2', 'revision', 'ช่วยตัดช่วงกลาง')
    const c = (await api.getClip('c2'))!
    expect([c.status, c.revision_note]).toEqual(['revision', 'ช่วยตัดช่วงกลาง'])
  })
  it('is owner only', async () => {
    await asCreator()
    await expect(api.restoreReview('c2', 'todo', '')).rejects.toThrow('ไม่มีสิทธิ์')
  })
})

describe('listExpiring', () => {
  it('lists files inside the warning window with their clip', async () => {
    await asOwner()
    const rows = await api.listExpiring()
    expect(rows.map((r) => r.id).sort()).toEqual(['m2', 'm5'])
    expect(rows[0]).toMatchObject({ clip_id: 'c1', clip_title: 'รีวิว Tissot PRX 40 มม.', days: 5 })
  })
  it('skips files of deleted clips', async () => {
    await asOwner()
    await api.softDeleteClip('c1')
    expect(await api.listExpiring()).toEqual([])
  })
})

describe('changePassword', () => {
  it('checks the current password and the length', async () => {
    await asCreator()
    await expect(api.changePassword('wrong', 'newpass123')).rejects.toThrow('รหัสผ่านปัจจุบันไม่ถูกต้อง')
    await expect(api.changePassword('creator1234', 'short')).rejects.toThrow('อย่างน้อย 8')
  })
  it('lets the user sign in with the new password', async () => {
    await asCreator()
    await api.changePassword('creator1234', 'newpass123')
    api.logout()
    await expect(api.login('creator@example.com', 'newpass123')).resolves.toBeTruthy()
  })
})
```

- [ ] **Step 2: Run them.** `npm test` — Expected: FAIL.

- [ ] **Step 3: Create `web/src/lib/attention.ts`.**

```ts
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
```

- [ ] **Step 4: Add to `web/src/lib/media.ts`.**

```ts
// R2 lifecycle counts from upload, so a brief planned far ahead can lose its files first.
export const expiresBeforeClip = (expires_at: string, clipDate: string) => expires_at.slice(0, 10) < clipDate
```

- [ ] **Step 5: Add to `web/src/api/index.ts`.** Add imports:

```ts
import { attentionOf, type Attention } from '@/lib/attention'
import { daysLeft, WARN_DAYS, canWithdraw } from '@/lib/media'
import { isIsoDate, todayIso } from '@/lib/dates'
```

Remove the old single-name imports of `canWithdraw` and `isIsoDate`. Add `ClipStatus` to the `@/lib/types` import. Then add after `reviewClip`:

```ts
export async function restoreReview(id: string, status: ClipStatus, note: string) {
  await wait()
  need('owner')
  const c = clipOf(id)
  c.status = status
  c.revision_note = note
  c.updated_at = stamp()
  save()
}

const RANK: Record<Attention, number> = { revision: 0, review: 1, overdue: 2 }

export async function listAttention() {
  await wait()
  const u = need()
  const today = todayIso()
  const rows = live().flatMap((c) => {
    const attention = attentionOf(c, u.role, today)
    return attention ? [{ ...toCard(c), attention }] : []
  })
  return out(rows.sort((a, b) => RANK[a.attention] - RANK[b.attention] || a.date.localeCompare(b.date) || a.position - b.position))
}
```

Add after `storageUsedBytes`:

```ts
export async function listExpiring() {
  await wait()
  need('owner')
  const clips = live()
  return out(db().media.flatMap((m) => {
    const clip = clips.find((c) => c.id === m.clip_id)
    const days = daysLeft(m.expires_at)
    return clip && days <= WARN_DAYS
      ? [{ id: m.id, file_name: m.file_name, clip_id: clip.id, clip_title: clip.title, days }]
      : []
  }).sort((a, b) => a.days - b.days))
}
```

Add after `logout`:

```ts
export async function changePassword(current: string, next: string) {
  await wait()
  const u = need()
  if (db().passwords[u.email] !== current) throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง')
  if (next.length < 8) throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')
  db().passwords[u.email] = next
  save()
}
```

- [ ] **Step 6: Add hooks to `web/src/api/queries.ts`.**

```ts
export const useAttention = () => useQuery({ queryKey: ['attention'], queryFn: api.listAttention })
export const useExpiring = (enabled: boolean) => useQuery({ queryKey: ['expiring'], queryFn: api.listExpiring, enabled })
```

- [ ] **Step 7: Verify and commit.**

```bash
npm test && npm run lint && npm run build
git add -A web/src
git commit -m "feat: add attention, expiring, review undo and change password to the API"
```

Expected: all tests pass. The test clock is Thu 29 Oct 2026, so seeded `c4` and `c5` are overdue.

---

### Task 4: Drafts that cannot lose work (B1, M3)

**Files:**
- Create: `web/src/lib/draft.ts`
- Modify: `web/src/pages/ClipForm.tsx`
- Test: `web/src/lib/lib.test.ts`

Why synchronous writes: a debounced write loses anything typed in the last second before a click on Back. Writing on every change removes the timer entirely.

- [ ] **Step 1: Write the failing test.** Add to `web/src/lib/lib.test.ts`, adding `beforeEach` to the `vitest` import:

```ts
import { clearDraft, isBlank, readDraft, sameBrief, writeDraft } from './draft'

describe('draft', () => {
  const form = { date: '2026-11-05', category_id: 'a', title: 'x', script: '', note: '' }
  beforeEach(() => localStorage.clear())

  it('keeps new-clip and per-clip drafts apart', () => {
    writeDraft({ ...form, title: 'new' })
    writeDraft({ ...form, title: 'one' }, 'c1')
    expect(readDraft()?.title).toBe('new')
    expect(readDraft('c1')?.title).toBe('one')
    clearDraft('c1')
    expect(readDraft('c1')).toBeNull()
    expect(readDraft()?.title).toBe('new')
  })
  it('survives corrupt storage', () => {
    localStorage.setItem('clip-draft', '{')
    expect(readDraft()).toBeNull()
  })
  it('ignores surrounding spaces in the title', () => {
    expect(sameBrief(form, { ...form, title: ' x ' })).toBe(true)
    expect(sameBrief(form, { ...form, script: 'y' })).toBe(false)
  })
  it('treats a form with only a date as blank', () => {
    expect(isBlank({ ...form, title: '' })).toBe(true)
    expect(isBlank(form)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it.** `npm test` — Expected: FAIL, cannot resolve `./draft`.

- [ ] **Step 3: Create `web/src/lib/draft.ts`.**

```ts
import type { ClipInput } from './types'

const key = (clipId?: string) => (clipId ? `clip-draft-${clipId}` : 'clip-draft')

export function readDraft(clipId?: string): ClipInput | null {
  try {
    return JSON.parse(localStorage.getItem(key(clipId)) ?? 'null')
  } catch {
    return null
  }
}

export const writeDraft = (form: ClipInput, clipId?: string) => localStorage.setItem(key(clipId), JSON.stringify(form))
export const clearDraft = (clipId?: string) => localStorage.removeItem(key(clipId))

export const sameBrief = (a: ClipInput, b: ClipInput) =>
  a.date === b.date && a.category_id === b.category_id && a.title.trim() === b.title.trim()
  && a.script === b.script && a.note === b.note

export const isBlank = (f: ClipInput) => !(f.title || f.script || f.note)
```

- [ ] **Step 4: Run it.** `npm test` — Expected: PASS.

- [ ] **Step 5: Rewire `web/src/pages/ClipForm.tsx`.**

Delete `const DRAFT_KEY = 'clip-draft'` and the whole `readDraft` function. Add:

```ts
import { clearDraft, isBlank, readDraft, sameBrief, writeDraft } from '@/lib/draft'
```

Replace the `draft` and `draftSaved` state lines with:

```ts
const [draft, setDraft] = useState(() => {
  const saved = readDraft(clipId)
  return saved && initial && sameBrief(saved, initial) ? null : saved
})
```

Replace the autosave `useEffect` with:

```ts
const pristine = initial ? sameBrief(form, initial) : isBlank(form)

// Written on every change, not debounced: leaving right after typing must not lose the text.
useEffect(() => {
  if (draft) return
  if (pristine) clearDraft(clipId)
  else writeDraft(form, clipId)
}, [form, pristine, clipId, draft])
```

In `submit`, replace `localStorage.removeItem(DRAFT_KEY)` with `clearDraft(clipId)`.

Replace the indicator line with:

```tsx
{!pristine && !draft && <span className="text-xs text-sub">✓ บันทึกร่างอัตโนมัติแล้ว</span>}
```

Replace the banner buttons with:

```tsx
<Button variant="outline" onClick={() => { clearDraft(clipId); setDraft(null) }}>ทิ้งร่าง</Button>
<Button onClick={() => { setForm((f) => ({ ...draft, date: explicitDate ?? (isIsoDate(draft.date) ? draft.date : f.date) })); setDraft(null) }}>กู้คืนร่าง</Button>
```

- [ ] **Step 6: Lock the form while a draft is unresolved.** Wrap the two-column grid `<div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1fr_360px]">...</div>` in:

```tsx
<fieldset disabled={!!draft} className="contents">
  {/* the existing grid div */}
</fieldset>
```

Change the save button's disabled prop to:

```tsx
disabled={save.isPending || cats.length === 0 || !!draft}
```

- [ ] **Step 7: Check in the browser.** `preview_start` with name `web`, sign in as `owner@example.com` / `owner1234`.
  1. Open a clip, type in the script, click Back at once, reopen. Expected: banner `พบร่างที่ยังไม่ได้บันทึก`; `กู้คืนร่าง` restores the text.
  2. On `/clips/new` type a title, leave, return. Expected: banner shows, all fields and save are disabled until you choose.
  3. Save an edit, reopen. Expected: no banner.

- [ ] **Step 8: Verify and commit.**

```bash
npm test && npm run lint && npm run build
git add -A web/src
git commit -m "fix: keep unsaved clip edits and stop drafts being overwritten"
```

---

### Task 5: Confirm reference delete, flag early expiry (B2, M10)

**Files:**
- Modify: `web/src/pages/ClipForm.tsx`, `web/src/components/bits.tsx`, `web/src/pages/ClipDetail.tsx`

- [ ] **Step 1: Flag early expiry in `FileTile`.** In `web/src/components/bits.tsx`, change the media import to include `expiresBeforeClip`:

```ts
import { daysLeft, expiresBeforeClip } from '@/lib/media'
```

Change the signature and the days line:

```tsx
export function FileTile({ file, clipDate, onDelete }: { file: ClipMedia; clipDate: string; onDelete?: () => void }) {
  const isVideo = file.kind === 'video'
  const early = expiresBeforeClip(file.expires_at, clipDate)
```

```tsx
<span className={`text-xs ${early ? `font-bold ${isVideo ? 'text-[#ffb04d]' : 'text-danger'}` : ''}`}>
  {early ? 'ลบก่อนถึงวันคลิป' : `ลบใน ${daysLeft(file.expires_at)} วัน`}
</span>
```

- [ ] **Step 2: Pass the clip date.** In `web/src/pages/ClipDetail.tsx`:

```tsx
{refs.map((f) => <FileTile key={f.id} file={f} clipDate={clip.date} />)}
```

- [ ] **Step 3: Confirm the delete.** In `web/src/pages/ClipForm.tsx`, replace the existing `bits` and `types` imports with the first two lines below, and add the third:

```ts
import { ConfirmDialog, FileTile, UploadDisabled } from '@/components/bits'
import type { ClipInput, ClipMedia } from '@/lib/types'
import { useLast } from '@/lib/useLast'
```

Add inside `Form`, after the `copying` state:

```ts
const [deletingFile, setDeletingFile] = useState<ClipMedia | null>(null)
const lastFile = useLast(deletingFile)
```

Replace the tiles line:

```tsx
<div className="grid grid-cols-2 gap-2">{refs.map((f) => <FileTile key={f.id} file={f} clipDate={form.date} onDelete={() => setDeletingFile(f)} />)}</div>
```

Add beside `{copying && ...}` at the end of the component:

```tsx
<ConfirmDialog open={!!deletingFile} title={`ลบไฟล์ “${lastFile?.file_name}”?`} body="ลบแล้วกู้คืนไม่ได้" confirm="ลบ"
  onConfirm={() => deletingFile && removeFile.mutate(deletingFile.id)} onClose={() => setDeletingFile(null)} />
```

- [ ] **Step 4: Check in the browser.** As owner, click `×` on a file on `/clips/c1`. Expected: dialog; `ยกเลิก` keeps the file, `ลบ` removes it.

- [ ] **Step 5: Verify and commit.**

```bash
npm test && npm run lint && npm run build
git add -A web/src
git commit -m "fix: confirm reference file delete and flag files expiring before the clip date"
```

---

### Task 6: Form bar, faster entry, shared pager, real back (M4, m7, m8)

**Files:**
- Create: `web/src/components/BackButton.tsx`, `web/src/components/ClipPager.tsx`
- Modify: `web/src/pages/ClipForm.tsx`, `web/src/pages/ClipDetail.tsx`

- [ ] **Step 1: Create `web/src/components/BackButton.tsx`.**

```tsx
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
```

- [ ] **Step 2: Create `web/src/components/ClipPager.tsx`.**

```tsx
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useClips } from '@/api/queries'
import { Button } from '@/components/ui/button'

export function ClipPager({ clipId, date }: { clipId: string; date: string }) {
  const nav = useNavigate()
  const { data: day = [] } = useClips(date, date)
  const i = day.findIndex((c) => c.id === clipId)
  // replace: paging through a day must not fill the history, so Back returns to the list.
  const go = (id: string) => nav(`/clips/${id}`, { replace: true })
  return (
    <div className="flex items-center gap-2 text-xs text-sub">
      {i >= 0 && <span>คลิป {i + 1} จาก {day.length} ของวันนั้น</span>}
      <Button variant="outline" size="icon" className="min-h-11 min-w-11 md:min-h-0 md:min-w-0" aria-label="คลิปก่อนหน้า" disabled={i <= 0} onClick={() => go(day[i - 1].id)}><ChevronLeft /></Button>
      <Button variant="outline" size="icon" className="min-h-11 min-w-11 md:min-h-0 md:min-w-0" aria-label="คลิปถัดไป" disabled={i < 0 || i >= day.length - 1} onClick={() => go(day[i + 1].id)}><ChevronRight /></Button>
    </div>
  )
}
```

- [ ] **Step 3: Use both in the creator view.** In `web/src/pages/ClipDetail.tsx`, replace the top bar `<div className="flex items-center justify-between">...</div>` with:

```tsx
<div className="flex flex-wrap items-center justify-between gap-2">
  <BackButton fallback={`/calendar?date=${clip.date}`} />
  <ClipPager clipId={id} date={clip.date} />
</div>
```

Delete `const nav`, `const { data: day = [] } = useClips(...)` and `const i = ...` from `CreatorDetail`. Fix imports:

```ts
import { Link, Navigate, useParams } from 'react-router-dom'
import { Play } from 'lucide-react'
import { useAct, useClip, useMe, useMedia } from '@/api/queries'
import { BackButton } from '@/components/BackButton'
import { ClipPager } from '@/components/ClipPager'
```

- [ ] **Step 4: Remount the new-clip form on every navigation.** Without this, "save and add another" keeps the old text, because the route does not change. In `web/src/pages/ClipForm.tsx`:

```ts
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
```

```tsx
export function ClipForm({ clipId }: { clipId?: string }) {
  const { data: clip, isPending } = useClip(clipId ?? '')
  const { key } = useLocation()
  if (clipId && isPending) return <p className="text-sm text-sub">กำลังโหลด...</p>
  if (clipId && !clip) return <p>ไม่พบคลิป <Link to="/calendar" className="text-brand">กลับปฏิทิน</Link></p>
  return <Form key={clipId ?? key} clipId={clipId} initial={clip ?? undefined} />
}
```

- [ ] **Step 5: Keep date and category when adding another.** In `Form`, replace the `useState<ClipInput>` initial value:

```ts
const [form, setForm] = useState<ClipInput>(initial
  ? { date: initial.date, category_id: initial.category_id, title: initial.title, script: initial.script, note: initial.note }
  : { date: explicitDate ?? todayIso(), category_id: params.get('cat') ?? '', title: '', script: '', note: '' })
```

Replace `submit`:

```ts
const submit = (addAnother = false) => {
  if (!isIsoDate(form.date)) { toast.error('วันที่ไม่ถูกต้อง'); return }
  if (!form.title.trim()) return setTitleError(true)
  const { date, script, note } = form
  save.mutate({ date, script, note, category_id: categoryId, title: form.title.trim() }, {
    onSuccess: (c) => {
      clearDraft(clipId)
      toast.success('บันทึกแล้ว')
      if (addAnother) nav(`/clips/new?date=${date}&cat=${categoryId}`, { replace: true })
      else if (!clipId) nav(`/clips/${c.id}`, { replace: true })
    },
  })
}
```

Add `autoFocus={!!params.get('cat')}` to the title `Input`, so the owner can type straight away.

- [ ] **Step 6: Replace the top bar.** Replace the whole first `<div className="flex flex-wrap items-center justify-between gap-2">...</div>` in `Form`'s return:

```tsx
<div className="flex flex-wrap items-center justify-between gap-2">
  <BackButton fallback={`/calendar?date=${form.date}`} />
  {initial && clipId && <ClipPager clipId={clipId} date={initial.date} />}
  {!pristine && !draft && <span className="text-xs text-sub">✓ บันทึกร่างอัตโนมัติแล้ว</span>}
  <div className="flex flex-wrap gap-2">
    {clipId
      ? <Button variant="outline" onClick={() => setCopying(true)}><Copy />คัดลอกไปวันอื่น</Button>
      : <Button variant="outline" onClick={() => submit(true)} disabled={save.isPending || cats.length === 0 || !!draft}>บันทึกและเพิ่มต่อ</Button>}
    <Button onClick={() => submit()} disabled={save.isPending || cats.length === 0 || !!draft}>บันทึก</Button>
  </div>
</div>
```

Removing `ยกเลิก` is deliberate: `กลับ` does the same job, and the draft stays recoverable.

- [ ] **Step 7: Move delete away from save.** At the end of the right column, after the reference files `<section>`, add:

```tsx
{clipId && <Button variant="outline" className="self-start border-danger text-danger max-md:min-h-11" onClick={() => void del(clipId)}><Trash2 />ลบคลิป</Button>}
```

Update imports: remove `ChevronLeft` from `lucide-react`; add

```ts
import { BackButton } from '@/components/BackButton'
import { ClipPager } from '@/components/ClipPager'
```

- [ ] **Step 8: Check in the browser.** As owner:
  1. `/clips/new?date=<today>`, pick `คอนเทนต์`, type a title, click `บันทึกและเพิ่มต่อ`. Expected: blank form, same date, `คอนเทนต์` still selected, cursor in title.
  2. Open a clip from search, click `กลับ`. Expected: search results return.
  3. On a clip use `คลิปถัดไป` twice, then `กลับ`. Expected: back to where you opened the first clip.
  4. Open `/clips/c1` directly in a new tab, click `กลับ`. Expected: calendar.

- [ ] **Step 9: Verify and commit.**

```bash
npm test && npm run lint && npm run build
git add -A web/src
git commit -m "feat: save and add another, owner clip pager, real back button"
```

---

### Task 7: Script first on phone and tablet (M1)

**Files:**
- Modify: `web/src/pages/ClipDetail.tsx`

`max-lg:contents` removes the two column wrappers below `lg`, so `order` can interleave their children: title, notes, script, files, submit.

- [ ] **Step 1: Let `NoteBox` take a class.**

```tsx
function NoteBox({ note, className = '' }: { note: string; className?: string }) {
  return (
    <section className={`rounded-card border border-note-line bg-note p-3 ${className}`}>
```

- [ ] **Step 2: Reorder.** In `CreatorDetail`:

Change the left column wrapper to `<div className="flex flex-col gap-3 max-lg:contents">`.

Change the script section's class to `rounded-card border border-line p-4 max-lg:order-2`.

Change the right column wrapper to `<div className="flex flex-col gap-3 max-lg:contents">` (this removes `max-lg:order-first`).

```tsx
{clip.note && <NoteBox note={clip.note} className="max-lg:order-1" />}
```

Change the reference section's class to `rounded-card border border-line p-3 max-lg:order-3`.

Change the submit section's class to `flex flex-col gap-2 rounded-card border border-line p-3 max-lg:order-4`.

- [ ] **Step 3: Check in the browser.** Sign in as `creator@example.com` / `creator1234`, set the viewport to mobile, open `/clips/c1`. Run:

```js
[...document.querySelectorAll('h1,h2')].map(e => [e.textContent.slice(0, 20), Math.round(e.getBoundingClientRect().top + scrollY)])
```

Expected order by y: title, `หมายเหตุ`, `สคริปต์`, `ไฟล์อ้างอิง`, `ส่งงาน`. Title y under 200 (was 900), `สคริปต์` y under 500 (was 965). Then check 1280 px: two columns as before.

- [ ] **Step 4: Verify and commit.**

```bash
npm test && npm run lint && npm run build
git add -A web/src
git commit -m "fix: show the script before upload on phone and tablet"
```

---

### Task 8: Review flow (M5)

**Files:**
- Modify: `web/src/pages/Review.tsx`

- [ ] **Step 1: Update imports and state.**

```ts
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
```

Remove the `Input` import. Add `ClipStatus` to the types import:

```ts
import type { ClipMedia, ClipStatus } from '@/lib/types'
```

After the `reason` state add:

```ts
const [asking, setAsking] = useState(false)
```

After the `review` line add:

```ts
const undo = useAct(({ status, note }: { status: ClipStatus; note: string }) => api.restoreReview(clipId, status, note))
```

- [ ] **Step 2: Add the handlers.** After `if (!clip) return null`:

```ts
const approve = () => {
  const before = { status: clip.status, note: clip.revision_note }
  review.mutate({ status: 'approved' }, {
    onSuccess: () => toast('อนุมัติแล้ว', { duration: 10_000, action: { label: 'เลิกทำ', onClick: () => undo.mutate(before) } }),
  })
}

const requestChanges = () => review.mutate({ status: 'revision', note: reason }, {
  onSuccess: () => {
    toast.success('ส่งคำขอแก้ไขแล้ว')
    setReason('')
    setAsking(false)
  },
})
```

- [ ] **Step 3: Replace the action row and the reason input.** Replace from `<div className="flex flex-wrap items-center justify-between gap-2">` through the `<Input aria-label="เหตุผลที่ขอแก้ไข" ... />` line:

```tsx
{asking ? (
  <div className="flex flex-col gap-2">
    <Textarea autoFocus rows={3} aria-label="เหตุผลที่ขอแก้ไข" placeholder="เหตุผลที่ขอแก้ไข (ครีเอเตอร์จะเห็นข้อความนี้)" value={reason} onChange={(e) => setReason(e.target.value)} />
    <span className="flex justify-end gap-2">
      <Button variant="outline" onClick={() => setAsking(false)}>ยกเลิก</Button>
      <Button disabled={review.isPending || !reason.trim()} onClick={requestChanges}>ส่งคำขอแก้ไข</Button>
    </span>
  </div>
) : (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <span className="text-xs">สถานะ: <StatusChip status={clip.status} /></span>
    <span className="flex gap-2">
      <Button variant="outline" className="border-[#ff9500] text-[#b35c00]" disabled={rounds.length === 0} onClick={() => setAsking(true)}>ขอแก้ไข</Button>
      <Button className="bg-[#1a7f3c] text-white hover:bg-[#1a7f3c]/90" disabled={review.isPending || rounds.length === 0 || clip.status === 'approved'} onClick={approve}>อนุมัติ</Button>
    </span>
  </div>
)}
```

- [ ] **Step 4: Check in the browser.** As owner on `/clips/c1`:
  1. `อนุมัติ`. Expected: toast with `เลิกทำ`; button disabled; status `อนุมัติแล้ว` (after Task 11, `ผ่าน` before it).
  2. `เลิกทำ`. Expected: status back to `ส่งแล้ว`.
  3. `ขอแก้ไข`. Expected: box opens with focus; `ส่งคำขอแก้ไข` disabled while empty; approve hidden.

- [ ] **Step 5: Verify and commit.**

```bash
npm test && npm run lint && npm run build
git add -A web/src
git commit -m "fix: ask for the revision reason first and add approve undo"
```

---

### Task 9: Home shows the work (M2, M10, m4)

**Files:**
- Modify: `web/src/pages/Home.tsx`

- [ ] **Step 1: Update imports and data.**

```ts
import { useAttention, useCategories, useClips, useExpiring, useMe, useRecent, useStorage } from '@/api/queries'
import { CategoryBadge, StatusChip } from '@/components/bits'
import { ATTENTION_LABEL } from '@/lib/attention'
```

After `const storage = ...`:

```ts
const attention = useAttention()
const expiring = useExpiring(owner)
const todo = attention.data ?? []
const dying = expiring.data ?? []
```

- [ ] **Step 2: Add the two blocks.** Insert directly after the greeting `<div>` and before the Today section:

```tsx
{todo.length > 0 && (
  <section className="flex flex-col gap-2">
    <h2 className="text-lg font-bold">งานของฉัน ({todo.length})</h2>
    <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
      {todo.map((c) => (
        <Link key={c.id} to={`/clips/${c.id}`} className="flex flex-col gap-1 rounded-card border border-[#ffb04d] bg-[#fff0e0] p-3">
          <div className="flex items-center justify-between gap-2 text-xs text-sub">
            <CategoryBadge categoryId={c.category_id} />
            <span className="font-bold text-[#b35c00]">{ATTENTION_LABEL[c.attention]} · {shortDate(fromIso(c.date))}</span>
          </div>
          <b className="text-sm">{c.title}</b>
          {c.attention === 'revision' && <p className="line-clamp-2 text-xs">{c.revision_note}</p>}
        </Link>
      ))}
    </div>
  </section>
)}

{dying.length > 0 && (
  <section role="status" className="flex flex-col gap-1 rounded-card border border-[#ffb04d] bg-[#fff0e0] p-3 text-sm">
    <b>มี {dying.length} ไฟล์ใกล้ถูกลบ</b>
    {dying.map((f) => (
      <Link key={f.id} to={`/clips/${f.clip_id}`} className="truncate text-xs underline">
        {f.file_name} · {f.clip_title} · ลบใน {f.days} วัน
      </Link>
    ))}
  </section>
)}
```

Add `shortDate` to the existing `@/lib/dates` import.

- [ ] **Step 3: Show status on today's cards.** Replace the Today card's top row:

```tsx
<div className="flex items-center justify-between gap-1 text-xs text-sub">
  <span className="flex flex-wrap items-center gap-1"><CategoryBadge categoryId={c.category_id} /><StatusChip status={c.status} /></span>
  คลิป {i + 1} จาก {todays.length}
</div>
```

- [ ] **Step 4: Compact the strip on phones.** Replace the strip grid class:

```tsx
<div className="grid grid-cols-7 overflow-hidden rounded-card border border-line">
```

Replace the day link class:

```tsx
className={`flex min-h-16 flex-col gap-1 border-r border-grid p-1 last:border-r-0 sm:min-h-24 sm:p-2 ${iso === today ? 'bg-today' : ''}`}
```

Add `hidden sm:block` to the bar span's class from Task 1:

```tsx
return <span key={c.id} className="hidden truncate rounded px-1 text-xs font-bold sm:block" style={{ background: bg, color: readableOn(bg) }}>{c.title}</span>
```

Replace the count line:

```tsx
<span className="text-center text-xs text-sub sm:text-left">
  <span className="sm:hidden">{list.length || ''}</span>
  <span className="hidden sm:inline">{list.length ? `${list.length} คลิป` : week.isError ? '' : 'ไม่มีคลิป'}</span>
</span>
```

- [ ] **Step 5: Check in the browser.**
  1. Creator, 375 px: `งานของฉัน` is first and lists `วิธีดูแลนาฬิกาออโตเมติก` with its revision reason; week strip is one row of 7 with no horizontal scroll.
  2. Owner: `งานของฉัน` lists `รีวิว Tissot PRX 40 มม.` as `รอตรวจ`; file warning lists `prx_dial.jpg` and `tissot_prx_v1_master.mov`.
  3. Run `document.documentElement.scrollWidth`. Expected: 375.

- [ ] **Step 6: Verify and commit.**

```bash
npm test && npm run lint && npm run build
git add -A web/src
git commit -m "feat: show pending work and expiring files on Home"
```

---

### Task 10: Calendar on phone and tablet (M9, m2, m3, m7)

**Files:**
- Modify: `web/src/pages/Calendar.tsx`, `web/src/components/ClipCard.tsx`

- [ ] **Step 1: Open the day sheet on phone.** In `MobileDay`, add `onOpen: (iso: string) => void` to the props type. Replace the `<h2>` with:

```tsx
<div className="flex items-center justify-between">
  <h2 className="text-sm font-bold">{dayLabel(p.selected)} {shortDate(p.selected)} · {list.length} คลิป</h2>
  <button type="button" onClick={() => p.onOpen(selIso)} className="min-h-11 px-2 text-sm text-brand">ดูทั้งวัน</button>
</div>
```

Pass it at the call site: `onOpen={setDrawer}`.

- [ ] **Step 2: Fix tap targets.** Prev and next buttons get `className="max-md:size-11"`. The view toggle button class becomes:

```tsx
className={`rounded-md px-3 py-1 text-sm max-md:min-h-11 ${view === v ? 'bg-brand text-white' : ''}`}
```

- [ ] **Step 3: Use the day view below `xl`.** Seven columns need about 130 px each, which only fits from 1280 px, where the sidebar leaves enough room.

```tsx
<div className="flex min-w-0 flex-col gap-3 xl:hidden">   {/* MobileDay root, was md:hidden */}
```

```tsx
<div className="hidden xl:block"><Week ... /></div>   {/* was hidden md:block */}
```

In `Week`, change the grid to `grid grid-cols-7 gap-2` and the column class `md:min-h-[70vh]` to `min-h-[70vh]`.

In `web/src/components/ClipCard.tsx`, change the script line's `md:hidden` to `xl:hidden`.

- [ ] **Step 4: Label the month chips on phone.** In `Month`, replace the chip's inner spans:

```tsx
<span className="hidden truncate sm:inline">{c.name}</span>
<span className="sm:hidden">{c.name.slice(0, 1)}</span>
<span>{n}</span>
```

After the closing tag of the month grid, wrap the return in a fragment and add a legend:

```tsx
<>
  {/* existing grid */}
  <div className="flex flex-wrap gap-3 text-xs text-sub sm:hidden">
    {cats.map((c) => (
      <span key={c.id} className="flex items-center gap-1">
        <span className="size-3 rounded-full" style={{ background: c.color }} />{c.name}
      </span>
    ))}
  </div>
</>
```

- [ ] **Step 5: Check in the browser.**
  1. Owner at 375 px: `ดูทั้งวัน` opens the drawer; `⋯` shows `ย้ายขึ้น` and `ย้ายลง`; moving a clip changes the order.
  2. At 768 px: one-day view, no 7 columns; clip cards at full width.
  3. At 1280 px: 7 columns.
  4. Month at 375 px: chips show `ร 1`, legend below.
  5. At 375 px, confirm toggle height 44: `[...document.querySelectorAll('[aria-pressed]')].map(b => b.offsetHeight)`.

- [ ] **Step 6: Verify and commit.**

```bash
npm test && npm run lint && npm run build
git add -A web/src
git commit -m "fix: day tools on phone, one-day view below 1280 px, labelled month chips"
```

---

### Task 11: Search, 404, shell, labels (B3, m1, m6, m8)

**Files:**
- Create: `web/src/pages/NotFound.tsx`
- Modify: `web/src/pages/Search.tsx`, `web/src/App.tsx`, `web/src/components/AppShell.tsx`, `web/src/lib/status.ts`

- [ ] **Step 1: Show search below `lg`.** The sidebar search box only exists from `lg`. In `web/src/pages/Search.tsx`, replace the comment and input:

```tsx
{/* The full sidebar starts at lg, so this input is the only search box below it. */}
<Input key={q} className="lg:hidden" aria-label="ค้นหาคลิป" placeholder="ค้นหาคลิป..." defaultValue={q} onKeyDown={(e) => e.key === 'Enter' && setParams({ q: e.currentTarget.value })} />
{!q && <p className="py-16 text-center text-sm text-sub">พิมพ์ชื่อคลิปหรือคำในสคริปต์ แล้วกด Enter</p>}
```

- [ ] **Step 2: Create `web/src/pages/NotFound.tsx`.**

```tsx
import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="font-bold">ไม่พบหน้านี้</p>
      <Link to="/" className="text-sm text-brand">กลับหน้าแรก</Link>
    </div>
  )
}
```

- [ ] **Step 3: Add the route.** In `web/src/App.tsx`, import it and add inside the `AppShell` route, after the `RequireOwner` block:

```tsx
<Route path="*" element={<NotFound />} />
```

- [ ] **Step 4: Fix the shell.** In `web/src/components/AppShell.tsx`, replace the title line:

```ts
const title = pathname === '/' ? 'หน้าแรก' : TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? 'ไม่พบหน้า'
```

Delete the whole `<div className="flex gap-1 text-sub">` holding the disabled Globe and Moon buttons. Remove `Globe` and `Moon` from the `lucide-react` import. Change the header class to `flex h-16 items-center border-b border-line px-4`.

- [ ] **Step 5: Fix the labels.** In `web/src/lib/status.ts`:

```ts
approved: { label: 'อนุมัติแล้ว', className: 'bg-[#e6f8ec] text-[#1a7f3c]' },
revision: { label: 'รอแก้ไข', className: 'bg-[#fff0e0] text-[#b35c00]' },
```

- [ ] **Step 6: Check in the browser.** At 768 px open `/search`. Expected: input and hint visible; typing `Tissot` and Enter shows results. Open `/nonsense`. Expected: shell with `ไม่พบหน้านี้`.

- [ ] **Step 7: Verify and commit.**

```bash
npm test && npm run lint && npm run build
git add -A web/src
git commit -m "fix: tablet search, 404 page, clearer status labels, remove dead header buttons"
```

---

### Task 12: Account (M8)

**Files:**
- Create: `web/src/components/ChangePasswordDialog.tsx`
- Modify: `web/src/components/AppShell.tsx`, `web/src/pages/Users.tsx`

Owner self-recovery is not in this task; it waits for Buddy (C3). Leave the login hint unchanged until then.

- [ ] **Step 1: Create `web/src/components/ChangePasswordDialog.tsx`.**

```tsx
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import * as api from '@/api/index'
import { useAct } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const change = useAct(({ current, next }: { current: string; next: string }) => api.changePassword(current, next))
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    change.mutate({ current: String(f.get('current')), next: String(f.get('next')) }, {
      onSuccess: () => { toast.success('เปลี่ยนรหัสผ่านแล้ว'); onClose() },
    })
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>เปลี่ยนรหัสผ่าน</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-1"><Label htmlFor="current">รหัสผ่านปัจจุบัน</Label><Input id="current" name="current" type="password" required autoComplete="current-password" /></div>
          <div className="grid gap-1"><Label htmlFor="next">รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</Label><Input id="next" name="next" type="password" required minLength={8} autoComplete="new-password" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={change.isPending}>บันทึก</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Add the entry point.** In `web/src/components/AppShell.tsx`:

```ts
import { Calendar, Home, KeyRound, LogOut, Menu, Search, Tag, User, Users } from 'lucide-react'
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog'
```

In `Sidebar`, add `const [changing, setChanging] = useState(false)`. In the rail block, before the logout button:

```tsx
{rail && <button onClick={() => setChanging(true)} aria-label="เปลี่ยนรหัสผ่าน" className="flex size-8 items-center justify-center text-sub"><KeyRound size={16} /></button>}
```

In the full block, before the logout button:

```tsx
<button onClick={() => setChanging(true)} className="block text-xs text-sub underline">เปลี่ยนรหัสผ่าน</button>
```

Before the closing `</div>` of the Sidebar root:

```tsx
{changing && <ChangePasswordDialog onClose={() => setChanging(false)} />}
```

- [ ] **Step 3: Extract the temp password dialog.** In `web/src/pages/Users.tsx`, delete the existing `<Dialog open={!!temp} ...>...</Dialog>` block and replace it with:

```tsx
{temp && <TempPassword temp={temp} onClose={() => setTemp(null)} />}
```

Add at the end of the file:

```tsx
function TempPassword({ temp, onClose }: { temp: { email: string; password: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => navigator.clipboard.writeText(temp.password)
    .then(() => toast.success('คัดลอกแล้ว'))
    .catch(() => toast.error('คัดลอกไม่สำเร็จ เลือกข้อความแล้วคัดลอกเอง'))
    // A failed copy still unlocks close, so the owner is never trapped here.
    .finally(() => setCopied(true))
  return (
    <Dialog open onOpenChange={(o) => !o && copied && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>รหัสผ่านชั่วคราว</DialogTitle>
          <DialogDescription>รหัสนี้จะไม่แสดงอีก คัดลอกก่อนจึงจะปิดได้</DialogDescription>
        </DialogHeader>
        <p className="text-sm">{temp.email}</p>
        <code className="rounded-card bg-surface p-3 text-lg select-all">{temp.password}</code>
        <DialogFooter>
          <Button variant="outline" onClick={() => void copy()}>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</Button>
          <Button disabled={!copied} onClick={onClose}>ปิด</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Add `import { toast } from 'sonner'`.

- [ ] **Step 4: Confirm reset.** In `Users`, add:

```ts
const [resetting, setResetting] = useState<Profile | null>(null)
const lastResetting = useLast(resetting)
```

Change the reset button's `onClick` to `onClick={() => setResetting(u)}`. Add beside the delete `ConfirmDialog`:

```tsx
<ConfirmDialog open={!!resetting} title={`รีเซ็ตรหัสผ่าน ${lastResetting?.display_name}?`} body="รหัสผ่านเดิมจะใช้ไม่ได้ทันที" confirm="รีเซ็ต"
  onConfirm={() => resetting && reset.mutate(resetting.id, { onSuccess: (password) => setTemp({ email: resetting.email, password }) })} onClose={() => setResetting(null)} />
```

- [ ] **Step 5: Check in the browser.**
  1. Owner, `/users`, reset Mook. Expected: confirm first; temp dialog after. Esc does nothing and `ปิด` is disabled until `คัดลอก` is clicked.
  2. Creator: `เปลี่ยนรหัสผ่าน` with a wrong current password shows the error toast; a correct change works at next login.
  3. Check the rail button at 768 px.

- [ ] **Step 6: Verify and commit.**

```bash
npm test && npm run lint && npm run build
git add -A web/src
git commit -m "feat: change password, confirm reset, protect the temporary password"
```

---

### Task 13: Categories (m5)

**Files:**
- Modify: `web/src/pages/Categories.tsx`

- [ ] **Step 1: Disable delete while clips use the category.** Replace the delete button:

```tsx
<Button variant="ghost" className="size-11 text-danger md:size-auto" disabled={(counts[c.id] ?? 0) > 0} aria-label={`ลบ ${c.name}`} onClick={() => setDeleting(c)}><Trash2 /><span className="max-md:hidden">ลบ</span></Button>
```

After the table's closing `</div>` (still inside `cats.length > 0`), wrap in a fragment and add:

```tsx
<p className="text-xs text-sub">ลบได้เฉพาะประเภทที่ไม่มีคลิป</p>
```

Change the `ConfirmDialog` body to `body="ลบแล้วกู้คืนไม่ได้"`.

- [ ] **Step 2: Default to an unused colour.**

```ts
import { nextColor } from '@/lib/color'
```

```tsx
{editing && <CategoryDialog editing={editing} used={cats.map((c) => c.color)} onClose={() => setEditing(null)} />}
```

```tsx
function CategoryDialog({ editing, used, onClose }: { editing: Category | 'new'; used: string[]; onClose: () => void }) {
```

```tsx
defaultValue={current?.color ?? nextColor(used)}
```

- [ ] **Step 3: Check in the browser.** Owner, `/categories`: delete buttons disabled on seeded rows; `เพิ่มประเภท` opens with `#ff9500`.

- [ ] **Step 4: Verify and commit.**

```bash
npm test && npm run lint && npm run build
git add -A web/src
git commit -m "fix: disable delete for used categories and default to an unused colour"
```

---

### Task 14: Docs and full check

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md`.**
  - Replace `fake-db-v1` with `fake-db-v2`.
  - Add `clips.brief_updated_at` to the assumed columns list.
  - Tokens: primary `#0066cc`, danger `#d70015`. Add success `#1a7f3c`.
  - Status values: รอทำ, ส่งแล้ว, อนุมัติแล้ว, รอแก้ไข.
  - Add: "Category text colour is computed with `readableOn`."
  - Add: "Week view is 7 columns from `xl` (1280 px); below that it is the one-day view."

- [ ] **Step 2: Run the whole check.**

```bash
npm test && npm run lint && npm run build
```

- [ ] **Step 3: Walk the audit in the browser.** Run `localStorage.clear(); sessionStorage.clear()` first.

| Check | Expected |
|---|---|
| Owner edits a clip, clicks `กลับ`, reopens | Restore banner |
| Owner clicks reference `×` | Confirm dialog |
| 768 px `/search` | Input visible |
| Creator 375 px `/clips/c1` | Title y under 200, script before upload |
| Creator Home | `งานของฉัน` with the revision reason |
| Owner Home | Pending review and expiring files |
| New clip, `บันทึกและเพิ่มต่อ` | Blank form, same date and category |
| Owner on a clip | Pager visible |
| Owner approves, then `เลิกทำ` | Earlier status returns |
| After approve, Home `แก้ไขล่าสุด` | Order unchanged |
| Owner 375 px calendar, `ดูทั้งวัน` | Move up and down work |
| Reset password | Confirm, and cannot close before copying |
| `/nonsense` | 404 inside the shell |
| 375, 768 and 1280 px on every page | `scrollWidth` equals the viewport |

- [ ] **Step 4: Commit.**

```bash
git add CLAUDE.md
git commit -m "docs: record UX fix tokens, labels and fake store key"
```

---

# Part B: Figma

File: `kpWQQKpAY5HuysQ8RH2XH7`. Node ids below come from `CLAUDE.md`.

**Rules for every Figma task:**
- Load the `figma:figma-use` skill before any `use_figma` call. If using TalkToFigma, ask the user for the channel and to open the matching page.
- The MCP has a call limit that blocked all calls on 2026-10-29. Batch changes in one script per page. If it blocks, stop and report.
- Edit light frames first. Then delete each edited frame's `Dark — …` copy and clone it again with the token map in `CLAUDE.md`. Find dark frames by name; their ids change.
- New frames go on the page matching their device.
- Update the node ids in `CLAUDE.md` at the end of each task.
- Match the shipped app. Check Part A's result before drawing.

### Task F1: Colour tokens (M7), all pages

Recolour with one script per page, the same method as the 2026-11-04 contrast pass:
- Brand fills and text `#0088ff` to `#0066cc`.
- Danger `#ff383c` to `#d70015`.
- Approve button fill to `#1a7f3c`.
- Category badges: filled with the category colour. Text `#ffffff` on รีวิว, `#1e1e1e` on คอนเทนต์.
- Week bars and month chips on คอนเทนต์: text `#1e1e1e`.

Dark frames keep `#0088ff` and `#ff383c` for text and icons, because the new values fall under 4.5:1 on `#1b1b1d` (`#0066cc` is about 3.1:1). Tell the user this splits brand into light and dark tokens.

### Task F2: Clip detail order (M1)

Order: title, notes, script, reference files, submit section. Also change the back button label to `กลับ`.

Frames: Mobile `99:1344`, `105:3657`, `105:5349`, `108:21894`, `112:4122`, `112:4207`; Tablet `102:1304`, `105:4458`, `112:4294`, `112:4430`.

### Task F3: Home (M2, M10, m4)

- Add the `งานของฉัน (n)` block first. Orange cards with category badge, `รอแก้ไข` / `เลยกำหนด` / `รอตรวจ`, date, title, and the reason on revision cards.
- Owner: add the file warning block, `มี n ไฟล์ใกล้ถูกลบ`, one row per file linking to its clip.
- Add status chips to today's cards.
- Mobile: check the week strip is one row of 7. If the frame already shows that, the code had drifted and only the code changes.

Frames: Desktop `63:160`, `63:387`, `103:2885`; Tablet `102:918`, `105:3986`; Mobile `99:918`, `105:3741`.

### Task F4: Clip form bar (M4, m7)

- New clip: `กลับ`, then `บันทึกและเพิ่มต่อ` and `บันทึก`. Remove `ยกเลิก`.
- Edit clip: `กลับ`, pager (`คลิป 1 จาก 2 ของวันนั้น` with `‹ ›`), `คัดลอกไปวันอื่น`, `บันทึก`.
- Move `ลบคลิป` to the bottom of the right column.

Frames: Desktop `74:1365`, `74:1459`, `74:1575`, `112:4877`, `60:174`, `103:2528`, `112:4568`; Tablet `105:6241`, `105:7442`; Mobile `99:1403`, `105:5252`, `112:4768`.

### Task F5: Review (M5)

Default row: status chip, `ขอแก้ไข`, `อนุมัติ`, with no reason box. Add one state where the reason box is open with `ยกเลิก` and `ส่งคำขอแก้ไข`. Add an undo toast `อนุมัติแล้ว · เลิกทำ`, based on `112:2079`.

Frames: Desktop `108:20979`, `103:2528`; Tablet `105:7442`; Mobile `108:21981`, `105:5252`.

### Task F6: Tablet calendar (m3)

Replace the 7 narrow columns with the mobile day layout: day picker, `ดูทั้งวัน`, full-width cards. Keep the 64 px rail.

Frames: `102:1100`, `105:4209`, `105:8462`, `105:8718`, `105:8969`. Update drawer frame `105:7120` so it opens over the new layout.

### Task F7: Account (M8)

New frames on Desktop, Tablet and Mobile: change password dialog; reset password confirm; sidebar with `เปลี่ยนรหัสผ่าน`.

Edit the temporary password frames `90:2097` and `105:7939`: description `รหัสนี้จะไม่แสดงอีก คัดลอกก่อนจึงจะปิดได้`, `ปิด` disabled, no `×`.

### Task F8: Small changes

| Change | Frames |
|---|---|
| Status text `ผ่าน` to `อนุมัติแล้ว`, `แก้ไข` to `รอแก้ไข` | Every status frame, starting at `108:20704`. Bulk text replace by exact match on status chips only |
| Month legend, chips with initial | `99:1120` |
| `ดูทั้งวัน` button | `105:3208`, `99:1025` |
| Toggle 44 px tall on phone | Mobile calendar frames |
| Disabled delete and hint | One set of `87:1665` or `93:890` (delete the duplicate set first), `105:5630`, `105:3426` |
| Search hint on empty query | `112:2973`, `112:3454` |
| New 404 frame | One frame per device |

---

# Part C: Message for Buddy

The user sends this. Do not edit `docs/system-design.md`.

**C1. New column `clips.brief_updated_at` (needed).** `updated_at` changes on approvals too, so `แก้ไขล่าสุด` tells the creator a brief changed when it did not. A trigger keeps it right with no frontend logic:

```sql
alter table clips add column brief_updated_at timestamptz not null default now();

create function touch_brief() returns trigger language plpgsql as $$
begin
  if (new.date, new.category_id, new.title, new.script, new.note)
     is distinct from (old.date, old.category_id, old.title, old.script, old.note)
  then new.brief_updated_at := now();
  end if;
  return new;
end $$;

create trigger clips_touch_brief before update on clips
  for each row execute function touch_brief();
```

**C2. Creator password reset by the owner (needed).** Add an Edge Function beside `create-creator`, for example `reset-creator-password`: check `is_owner()`, call `auth.admin.updateUserById` with a generated password, return it once.

**C3. Owner account recovery (decision needed).** The owner has no one to ask. Options: `resetPasswordForEmail` (needs SMTP on Supabase) or a manual reset by Buddy in the dashboard. The login page hint changes once this is picked.

**C4. Change own password (no schema).** Add to spec §1: any signed-in user can change their own password through `auth.updateUser`. Decide whether to require the current password; the UI asks for it.

**C5. Status confirmation (blocks Tasks 8 and 9 going live).** `clips.status` and `clips.revision_note` are still open in §12. `งานของฉัน` and the review flow depend on them. Labels are now รอทำ, ส่งแล้ว, อนุมัติแล้ว, รอแก้ไข.

**C6. Queries the frontend now needs.** Both work with the current RLS:
- Attention: owner `status = 'submitted'`; creator `status = 'revision'` or `status = 'todo' and date < today`.
- Expiring: `clip_media` with `expires_at <= now() + interval '7 days'`, owner only, joined to live clips.

**C7. Review undo.** The owner restores the earlier `status` and `revision_note` with a normal update. No policy change.

**C8. Reminder from the earlier handoff.** Copies share reference files and keep the original `expires_at`, so a copy planned far ahead can lose its files before its date. The UI now flags this with `ลบก่อนถึงวันคลิป`; the rule itself stays Buddy's call.
