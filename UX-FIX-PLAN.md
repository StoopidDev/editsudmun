# UX Fix Plan

**Status (2026-11-04): all 14 fixes are applied in Figma** (light and dark, Desktop, Tablet, Mobile, including the mobile clip menu with move up and down). Node ids are in `CLAUDE.md`. The only items still waiting on other people are not design work: D1 (the client picks the retention length) and the real product name (the client supplies it). the 30-day auto-delete stays, with days-left badges, a warning and download-all.

Source: `/ux audit` of the Figma design (2026-11-04).
Figma file: https://www.figma.com/design/kpWQQKpAY5HuysQ8RH2XH7/Content-Making-Tools. Node ids and design tokens are listed in `CLAUDE.md`.
Users: the owner (plans clips, checks work) and the creator (reads briefs, uploads finished edits). Daily use, growing from 1 to 2 clips a day up to 50 to 70.

## 1. Decisions to settle first

These change both the frames and the backend. Settle them before building the affected fixes.

| ID | Question | Options | Recommended | Who decides |
|----|----------|---------|-------------|-------------|
| D1 | File retention | A: keep 30 days, with a warning before deletion and an export option. B: no auto-delete; the owner archives files manually. C: keep approved work and delete rejected rounds. | B (matches pain point 3, "files must not expire"). Storage cost grows over time; see spec §8.2. | Client and Buddy |
| D2 | Creator uploads the wrong submission | A: the creator can withdraw a file within 10 minutes, then it locks. B: only the owner can delete. | A (fixes misclicks; uploads stay locked as evidence after 10 minutes) | Buddy (changes the RLS rules) |
| D3 | Deleting a clip | Undo toast, or confirm modal | Undo toast (faster for a daily action, and the user can recover) | User |

**Decided (user, then Buddy, 2026-11-04):** D1 = A (keep the auto-delete; Buddy overruled option B because archiving only hides a file while it stays in R2 and keeps costing money), D2 = A (10-minute withdraw, Buddy agrees), D3 = undo toast / soft delete (Buddy agrees).

**D1 is not final.** Buddy wants to talk to the client first, because the client's pain point 3 says files must not expire. Until then, build the S4 fix below (warnings and download); the retention length (30 days, shorter, or delete after approval) is the client's call.

Effects of the decisions:
- D1 = A: build days-left badges, the pre-delete warning and a "ดาวน์โหลดทั้งหมด" button, so the owner can keep a copy of anything they care about. No archive feature: it would hide files but keep paying for them. Backend: keep the R2 lifecycle and the pg_cron cleanup from the spec; no `archived_at` column.
- D2 = A: build the withdraw control and the RLS exception.
- D3: build the undo toast; the backend needs a soft delete (`deleted_at`) kept for at least 10 seconds.
- Buddy and the client still need to be told about D1 and D2.

## 2. Fix list (by severity)

Severity: 4 blocker, 3 major, 2 minor, 1 cosmetic.

### S4. Files disappear without warning
- **Problem:** the 30-day auto-delete removes reference files and submissions with no warning and no export. Only the owner's submission list shows how many days are left.
- **Fix (D1 = A):** show a days-left badge on every file, warn the owner 3 to 7 days before deletion, and add a "ดาวน์โหลดทั้งหมด" button per clip. If the client later picks a different retention rule, only the badge numbers change.
- **Frames:** clip detail creator `60:61`, owner `60:174`, creator submit `102:2240`, owner review `103:2528`, plus their tablet and mobile versions. Storage widget `103:2885`.
- **Backend:** depends on D1 (R2 lifecycle rules, pg_cron).
- **Done when:** every file row shows its retention state, and a warning frame exists.

### S3. Deleting a clip has no safety net
- **Fix:** add an undo toast ("ลบคลิปแล้ว · เลิกทำ", 10 s) on the calendar and on clip detail. Depends on D3.
- **Frames:** new frames on desktop, tablet and mobile (light and dark).
- **Done when:** the delete action ends in a recoverable state.

### S3. Search has no results screen
- **Problem:** searching scripts is pain point 2, but the sidebar search and the mobile "ค้นหา" tab open nothing.
- **Fix:** a results list where each row shows the title, a script snippet with the match highlighted, the date and the category. Add a no-results state ("ไม่พบคลิปที่ตรงกับ “…”" plus suggestions).
- **Frames:** new frames on desktop, tablet and mobile (light and dark).
- **Backend:** full-text search over `clips.title`, `script` and `note`.

### S3. Add-clip form can lose a long script
- **Fix:** autosave a local draft, show a "บันทึกร่างแล้ว" indicator, and show a restore-draft banner when the form reopens.
- **Frames:** `74:1365`, `74:1459`, tablet `105:6241`, mobile `99:1403`.

### S3. A wrong submission is permanent
- **Fix (if D2 = A):** add a "ถอนไฟล์ (เหลือ 9 นาที)" control to the newest submission row, which disappears after 10 minutes.
- **Frames:** creator submit `102:2240`, tablet `105:4458`, mobile `105:3657`.
- **Backend:** an RLS delete exception on `clip_media` when `uploaded_by = auth.uid()` and `created_at > now() - 10 min`.

### S3. Recently Edited promises data that does not exist
- **Problem:** the widget describes each change ("แก้ไขสคริปต์"), but the backend only stores `updated_at`.
- **Fix:** show only "แก้ไขเมื่อ X นาทีที่แล้ว", unless Buddy adds an audit table.
- **Frames:** Home `63:160`, `63:387`, `103:2885`, plus their tablet, mobile and dark copies.

### S3. Low-contrast small text
- **Problem:** `#757575` on the `#f5f5f5` surface is about 4.2:1, and is often used at 10 to 11 px. Orange status text on its tint is about 2:1.
- **Fix:** change the secondary text colour to `#5f5f5f`, set a 12 px minimum, and darken the orange label (about `#b35c00`). Apply across all pages with a recolor script, using the same method as the dark-mode recolor. Update the tokens in `CLAUDE.md`.

### S2. Drag-only reordering
- **Fix:** add "ย้ายขึ้น / ย้ายลง" to the ⋯ menu.
- **Frames:** drawer `74:12986`, tablet drawer `105:7120`, mobile day sheet `105:3860`.

### S2. Dense days have no filter
- **Fix:** add a category chip row (ทั้งหมด / รีวิว / คอนเทนต์) at the top of the day drawer and the mobile day sheet.

### S2. English mixed into the Thai UI
- **Fix:** "Welcome Back!" becomes "ยินดีต้อนรับกลับมา", the "Owner" / "Creator" badges become "เจ้าของ" / "ครีเอเตอร์", and the placeholder "Channel 's Tool" gets the real product name (to be supplied by the client). Do a bulk text replace across all pages.

### S2. Upload failures are not designed
- **Fix:** add upload rows for "เน็ตหลุด กำลังลองใหม่…" and "อัปไม่สำเร็จ แตะเพื่ออัปต่อ".
- **Frames:** creator submit and add-clip reference upload, on all devices.

### S2. Forgot password has no path
- **Fix:** add the hint "ลืมรหัสผ่าน? ติดต่อเจ้าของช่องเพื่อรีเซ็ต" to the login frames (`92:1279`, `92:1301`, `92:1324`, mobile `92:1347` to `92:1392`, and the tablet copies).

### S2. Small touch targets on mobile
- **Fix:** replace the "แก้ไข / ลบ" text links with 44 px icon buttons.
- **Frames:** `105:3426`, `105:3538`.

### S1. Temporary password shown only once
- **Fix:** add the hint "รหัสนี้จะไม่แสดงอีก คัดลอกเก็บไว้ก่อนปิด".
- **Frames:** `90:2097`, tablet `105:7939`.

## 3. Execution order

1. Settle D1, D2 and D3.
2. Make the bulk fixes first (contrast tokens, Thai copy), so that new frames inherit them.
3. Build the new frames: search, delete undo, upload failures, withdraw, retention.
4. Make the small edits: reorder menu, dense-day filter, forgot-password hint, touch targets, temporary-password hint.
5. Regenerate the dark copies of every changed frame. Dark copies are clones, so delete the old copy and clone it again.
6. Update `CLAUDE.md`: new node ids and the token change.

## 4. Backend handoff (Buddy)

- Retention rule from D1: keep R2 lifecycle per prefix, `expires_at` and the pg_cron job (unchanged). Make the retention length a single setting. The app also needs to read `expires_at` to show days left.
- Full-text search over clips.
- RLS withdraw exception on `clip_media` (D2).
- Optional: an audit table for Recently Edited.
- Already noted in `CLAUDE.md`: a status column, a revision note, and a `notifications` table.

## 5. Verification

- Take a screenshot of every new or changed frame, light and dark.
- Rerun the dark-frame audit script (leftover light fills, dark text, light scrims).
- Check the new tokens with a WCAG contrast calculator: at least 4.5:1 for text under 18 px.
- Confirm that the "Not designed yet" section of `CLAUDE.md` stays empty and lists every new node id.
