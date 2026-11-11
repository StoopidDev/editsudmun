# Frontend Finish: Media UI, Dark Mode, Motion, Hover/Press Feedback, Figma Fidelity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development, with the model split below (user's rule, 2026-11-12). Steps use checkbox (`- [ ]`) syntax for tracking.

## Execution model (user's rule)

| Role | Who | How it is started |
|---|---|---|
| Coordinator | main session | holds the plan, cuts chunks, runs the gate, talks to the user, does Tasks 1, 2 and 15 itself (they need the browser pane, the user's sign-in, the Figma channel and push approval) |
| Implementer | **Haiku 5.5, effort medium**, one fresh subagent per chunk | `Agent({ model: "haiku", effort: "medium", subagent_type: "general-purpose", prompt })` |
| Reviewer | **Sonnet 5.5, effort high**, one fresh subagent per finished chunk | `Agent({ model: "sonnet", effort: "high", subagent_type: "general-purpose", prompt })`, read-only: it reports, it does not edit |

**Chunks** (each ends with one commit per task inside it):

| Chunk | Tasks | Done when |
|---|---|---|
| C1 | 1, 2 (coordinator) | app runs or the no-login fallback is noted; baseline table exists |
| C2 | 2b, 3, 4, 5 | tokens + dark variables, button fix, press/hover, pending, skeletons |
| C3 | 6, 7, 8 | uploader, provider, UploadZone |
| C4 | 9, 10 | thumbnails, lightbox, player, downloads, form uploads |
| C5 | 11, 12, 13 | optimistic writes, view transitions, drawers, sidebar collapse |
| C6 | 13b, 14 | dark toggle, Figma fidelity sweep |
| C7 | 15 (coordinator) | judges, handoff doc, PR |

**Loop per chunk (C2 to C6):**
1. Coordinator sends the implementer: the chunk's task text copied in full from this plan, the scope rule, the §3 Figma spec rows it touches, the house rules (CLAUDE.md "Stack" notes: base-ui `render` not `asChild`; all data through `api/index.ts`; Thai copy exact), and "commit per task, do not push, do not touch `supabase/`".
2. Implementer works, runs `cd web && npm run lint && npm test && npm run build`, commits, reports the commit range and anything it could not do.
3. **Gate (coordinator):** reruns the three commands; `git diff --stat main...HEAD -- supabase` must be empty. Fail → back to the implementer with the output.
4. Reviewer gets: the commit range, the same task text and spec rows, and this checklist: matches the plan and Figma copy exactly; no backend touched; light and dark both use tokens (no new hex literals in TSX); reduced-motion path present for any new motion; hover only under `(hover: hover)`; keyboard and focus intact; no data loss path (uploads, deletes, optimistic rollback); tests cover new pure logic. Output: findings ranked blocker / major / minor with `file:line` and a fix.
5. Blockers and majors → a new Haiku implementer with the findings; then the reviewer checks only those fixes. **At most 2 review rounds**; anything still open after that, the coordinator fixes or lists it in the PR description. Minors go to the PR description unless trivial.
6. Coordinator spot-checks the result in the browser pane (light, dark, 375 / 768 / 1440) when a dev login is available, then starts the next chunk.

Chunks run one after another, never in parallel: they share `index.css`, `bits.tsx` and the page files.

**Goal:** Buddy's backend (M1 data/auth, M2 R2 upload/view, M3 prod) is live, so the frontend stops pretending: files upload, play and download for real; every action the user takes is acknowledged within 100 ms and its result is visible; screens match the Figma frames; motion explains state instead of decorating it.

**Architecture:** No new layers. All data still goes through `web/src/api/index.ts`. One new module owns uploads (`web/src/lib/uploader.ts`, a headless Uppy instance that lives at app root so uploads survive navigation). Motion is CSS tokens plus the View Transitions API through React Router's `viewTransition`; no animation library. Feedback is a small set of shared primitives (pressed state, pending button, optimistic cache update, skeleton) applied everywhere instead of per-screen one-offs.

**Scope rule (from the user, 2026-11-12):** everything below lands in **one pass on one branch, one PR**; no phases, no follow-up plan. **Only `web/` and `docs/` change.** Nothing in `supabase/` (no migrations, Edge Functions, secrets, RLS, bucket CORS or lifecycle), no new tables or columns, no backend accounts created with service keys. Where a frontend piece needs something the backend does not give yet, or can only be proven against the live backend, it is built against the existing `web/src/api/index.ts` functions and listed in `docs/buddy-handoff-2026-11-12.md` for Buddy, who ties front and back together after the PR.

**Tech Stack:** React 19, Vite 8, TS 7, Tailwind v4, shadcn base-nova on `@base-ui/react` 1.9 (has `Drawer` with swipe), TanStack Query 5, React Router 7, sonner, Uppy (`@uppy/core` + `@uppy/aws-s3`, headless, new), Vitest.

---

## 0. Why this plan aims higher than "fix the screens"

**Goal beyond the goal:** on handoff day the owner and the creator stop using LINE for briefs and files. That happens only if they trust the app more than LINE: a file they send is visibly *there*, an approval visibly *landed*, nothing silently fails.

**Outside judges (not us grading ourselves):**
1. **Figma pairs.** For every frame listed in §3, a screenshot of the app at the frame's width sits next to the Figma export in `docs/qa/2026-11-12/`. A pair passes when a reviewer finds no difference in content, order, labels, states or colour; spacing within 4 px is fine. Exceptions are written down with a reason.
2. **Real upload on dev R2 (run by Buddy after the PR, listed in the handoff; we run it only if a dev login is available in the browser pane).** A 300 MB MP4 uploaded from the app, interrupted (DevTools offline) at ~40 %, resumes and completes; the row lands in "ส่งแล้ว" and plays. A 2.1 GB file and a `.zip` are refused before any network call. A ProRes `.mov` downloads under its Thai name.
3. **Response.** Every pressable control shows its pressed state on pointer-down (no wait for `click`), and every mutation shows a pending state within one frame. Checked with the DevTools Performance panel on 3 interactions (approve, move clip, save), INP under 200 ms on a 4x CPU throttle.
4. **Reduced motion.** With `prefers-reduced-motion: reduce` emulated, no element moves spatially; state changes still show (opacity/colour).
4b. **Dark mode.** Every route in dark matches its "Dark — …" Figma frame (tokens in CLAUDE.md "Dark mode"); text contrast at least 4.5:1 (checked with the existing `contrast()` in `src/lib/color.ts` over the token pairs in a unit test); no light flash on reload in dark.
5. `npm run lint`, `npm test`, `npm run build` in `web/` all pass; impeccable detector over changed files has no unresolved findings.

**What was skipped on purpose:** notifications (client not confirmed, and they need a `notifications` table: backend), drag-to-reorder (needs a bulk reorder RPC to be reliable; up/down menu items already work; listed in the handoff), the header globe/language icon (no second language), i18n, a motion library (CSS + View Transitions cover every case here).

---

## 1. Decisions to confirm before Task 1 (recommended option first)

| # | Decision | Recommended | Alternative | Why |
|---|---|---|---|---|
| D1 | Upload engine | **Uppy headless** (`@uppy/core` + `@uppy/aws-s3`), our own UI | Hand-rolled XHR uploader (~150 lines) | Spec names Uppy; it gives retry, pause/resume, part concurrency and resume-from-`listParts` for 2 GB files. Its Dashboard UI is not used, so Figma stays exact. |
| D2 | Uploading on a **new** clip (Figma `103:2720` shows uploads on add-clip) | **Save the clip first, automatically, on the first dropped file** (needs a title; if empty, focus the title with "กรอกหัวข้อก่อนแนบไฟล์") | Drop zone disabled until first save | Upload needs a `clip_id`. Auto-save keeps the Figma flow with one rule. |
| D3 | Dark mode | **Decided by the user: in this pass.** Moon/sun toggle in the header (Figma position), three states stored per browser: system (default), light, dark | — | Only ~40 hard-coded colour classes in 10 files, so moving them to tokens is small. |
| D4 | Mobile day sheet | **Bottom `Drawer` with swipe-to-close below `md`**, right `Sheet` from `md` | Keep right sheet everywhere | Figma `105:3860` is a bottom sheet; base-ui 1.9 ships `Drawer` with gestures, so no new code for physics. |
| D5 | Sidebar collapse icon (Figma desktop header) | **Implement**: collapses the `lg` sidebar into the existing 64 px rail, remembered in localStorage | Leave out | The rail already exists; this is ~15 lines. |

---

## 2. Current state (audited 2026-11-12 on `main` @ `9028a88`)

Backend is merged into `main`; the local `ux-audit-fixes` branch is fully merged and can be deleted.

### Broken now
| Where | Problem |
|---|---|
| `web/src/components/ui/button.tsx:6` | Class string has `max-md:min-w-11items-center` (missing space). So **`items-center` never applies to any button**, and the 44 px min width on phones is lost. Icon+label buttons rely on stretch alignment by luck. |
| `web/src/main.tsx:40` | `<Toaster position="bottom-center">` sits over the 64 px mobile tab bar (`AppShell.tsx:789`), covering the undo action in the delete toast on phones. |
| Every page | Loading is the text "กำลังโหลด..." or one grey bar; Figma has skeleton frames (`102:1935`, `105:8969`, `108:9814`). |
| Upload | `UploadDisabled` placeholder in `ClipForm.tsx:341` and `ClipDetail.tsx:74`: "เปิดใช้เมื่อเชื่อมต่อระบบหลังบ้านแล้ว". Backend is connected now, so this copy is false. |
| Playback | `Review.tsx:148-152`: fake player "วิดีโอจริงจะเล่นได้หลังเชื่อมต่อ R2". Download buttons are `disabled` (`Review.tsx:165`, `ClipForm.tsx:302`). |
| Thumbnails | `FileTile` shows an icon, never the image; there is no lightbox ("แตะรูปเพื่อขยาย" in Figma). |
| Navigating away | No upload exists yet, but once it does: leaving the clip page must not kill a 2 GB upload. |
| Local env | `web/.env.local` and `supabase/.env` are missing on this machine, so the app cannot run here yet. |

### Missing feedback (no acknowledgement or no visible result)
| Action | Today | Needed |
|---|---|---|
| Any button press | `active:translate-y-px` only after the click lands | Pressed scale on pointer-down, 100 ms |
| Save / approve / request changes / create user / reset / delete | Button disables, no spinner; toast after server round trip | Pending spinner in the button, then result in place (chip changes, row appears) |
| Move clip up/down (`DayDrawer`) | Waits for the RPC, then the list jumps | Optimistic reorder, card slides to its new slot |
| Delete clip | Card disappears after refetch | Card collapses out immediately; undo puts it back with the reverse motion |
| Approve | Toast only | Status chip morphs to green "อนุมัติแล้ว" with a check; undo reverses it |
| Navigation | Hard cut | 150 ms cross-fade; clip card title morphs into the detail title |
| Week/month prev/next | Hard cut | Content slides in the direction of travel |
| Upload | n/a | Progress bar, pause/resume, cancel, inline error, row lands in the list |

### Not matching Figma (from frames `63:160`, `54:54`, `102:2240`, `103:2528`, `103:2720`; the rest of §3 is checked in Task 2)
| Frame | Gap in code |
|---|---|
| Home `63:160` | Owner "งานของฉัน" card lacks "ครีเอเตอร์ส่งงานแล้ว N รอบ"; today cards lack the image count and "หมายเหตุ" indicators (ClipCard has them, Home re-implements the card without them); status on today cards is drawn as a dot + label, code uses a filled chip; "เพิ่มคลิปวันนี้" tile is taller with centered icon. |
| Calendar week `54:54` | Matches except: day header count is below the date inside the today pill (code puts count outside on non-today days the same way, OK); "+ เพิ่มคลิป" ghost button sits directly after the last card (OK). Week card has no script line at `xl` (OK). Verify spacing only. |
| Creator detail `102:2240` | Note box heading has a document icon; reference header has "แตะรูปเพื่อขยาย" on the right; reference tiles are real thumbnails, video tile is dark with name and duration; footer "ไฟล์อ้างอิงจะถูกลบอัตโนมัติใน 29 วัน · ดาวน์โหลดไว้ก่อนได้"; upload row (name, "1.2 / 1.8 GB · 66%", bar, "หยุดชั่วคราว", "ยกเลิก"); dropzone second line "ถ้าเน็ตหลุดระหว่างอัป จะอัปต่อจากเดิมได้"; submission row has a play button, "ส่งเมื่อ 28 ต.ค. 14:20" and right-aligned "ลบใน 29 วัน". |
| Owner review `103:2528` | Header right "ใช้พื้นที่ 2.9 GB · ลบอัตโนมัติหลัง 30 วัน"; "ดาวน์โหลดทั้งหมด" outline button under the heading; real video player with time; rows show upload time; ProRes row: "ดาวน์โหลด" enabled. Category and day are select-style fields with a chevron showing "พฤหัส 29 ต.ค. 2026" (code: native `<select>` and `<input type=date>` which renders `29/10/2026`). Reference grid has an "อัปโหลดรูป" tile as the last cell. |
| Add clip `103:2720` | Real image thumbnails with captions; video tile with play icon and duration; upload progress row; error row "ไม่รองรับไฟล์ชนิดนี้ อัปได้เฉพาะรูปภาพและวิดีโอ" with "ลบออก"; dropzone "ลากรูปหรือวิดีโอมาวาง หรือคลิกเพื่อเลือกไฟล์ / รูปภาพ และวิดีโอ MP4 / MOV ไม่เกิน 2 GB"; footer retention line. (Figma still shows "ยกเลิก" here; CLAUDE.md says add-clip frames were changed to "บันทึกและเพิ่มต่อ": keep the code, re-check the frame in Task 2.) |

---

## 3. Figma frames this plan is judged against

Desktop 1440: `63:160`, `103:2885`, `63:387`, `54:54`, `60:317`, `65:96`, `65:619`, `102:1413`, `102:1676`, `102:1935`, `60:61`, `102:2240`, `102:2384`, `103:2528`, `103:2720`, `74:1365`, `74:1459`, `74:1575`, `74:12986`, `74:13528`, `87:1665`, `87:1749`, `90:1896`, `90:1990`, `90:2097`, `92:1279`, `92:1324`, `112:2079`, `112:2686`, `112:3260`, `112:3691`, `112:3834`, `112:3977`, `112:4568`, `112:4877`, `130:2858`, `130:3071`, `130:4442`, `130:5428`.
Tablet 768: `102:918`, `105:3986`, `105:4209`, `105:4458`, `105:7442`, `105:6241`, `105:8969`, `112:4294`, `112:4430`.
Mobile 375: `99:918`, `105:3741`, `105:3208`, `105:3860`, `105:3657`, `105:5252`, `105:5349`, `108:9814`, `112:2569`, `112:4122`, `112:4207`, `112:20909`.

Figma MCP is on the Starter plan and hit its call limit on 2026-11-12 after 5 frames. The Talk To Figma plugin (channel `dqmq16on`, `join_channel` first) works for `get_node_info` (full node tree with text, fills, font sizes), but `export_node_as_image` and `scan_text_nodes` fail or time out. Task 2 uses `get_node_info` for specs and the Figma desktop app (File > Export, PNG 1x) for the reference images.

### Specs already read through Talk To Figma (desktop, creator clip detail `112:3691`, `112:3834`, `112:3977`)

| Element | Figma | Code today |
|---|---|---|
| Upload row, network lost | fill `#b35c00` at 12 %, 1 px border `#b35c00`, bar `#b35c00` on `#d9d9d9` track (6 px, radius 3); right text "เน็ตหลุด · กำลังลองใหม่ (ครั้งที่ 2)"; actions "หยุดชั่วคราว" (brand) "ยกเลิก" (sub) | none |
| Upload row, failed | fill `#d70015` at 10 %, border `#d70015`, red bar frozen at the % reached; right text "อัปไม่สำเร็จที่ 66%"; actions "อัปต่อจากเดิม" (brand) "ยกเลิกไฟล์นี้" (sub) | none |
| Withdraw | full-width outline button, border and text `#d70015`, 36 px, "ถอนไฟล์นี้ (เหลือ 9 นาที)", directly under the submission row; hint "ถอนไฟล์ได้ภายใน 10 นาทีหลังส่ง หลังจากนั้นล็อก และแก้ไม่ได้ ต้องส่งเป็นรอบใหม่" | button inside the row; hint copy differs |
| Submit hint, no withdraw open | "ส่งแล้วลบหรือแก้ไม่ได้ ถ้าต้องแก้ให้ส่งเป็นรอบใหม่" | withdraw hint always shown |
| Submit header right | "ไฟล์ตัดต่อเสร็จ · MP4 ≤ 2 GB" (12 Light) | "ไฟล์ที่ตัดต่อแล้ว · MP4 ≤ 2 GB" |
| Dropzone | `#f5f5f5` fill, solid `#757575` border, 60 px tall, two centered 12 px lines | dashed, opacity 70 % |
| Submission row | 58 px, border `#d9d9d9`; 32 px round play button `#eaf4ff` with brand triangle; "รอบ 1" badge `#f5f5f5` radius 10; line 2 "820 MB · ส่งเมื่อ 28 ต.ค. 14:20"; right "ลบใน 29 วัน" (12 Light) | no play button, no time, days inline |
| Reference card | header "ไฟล์อ้างอิง 6 ไฟล์" (14 Bold) + right "แตะรูปเพื่อดูขยาย" (12 Light); 3-column grid of 103x68 tiles, gap 8; video tile `#262626` with white triangle and "ref_intro.mp4 · 0:42"; footer "ไฟล์อ้างอิงจะถูกลบอัตโนมัติใน 29 วัน · ดาวน์โหลดไว้ก่อนได้" | "ไฟล์อ้างอิง N ไฟล์", no hint, no footer, h-20 tiles |
| Title | Geist Bold 32 / 41.6 | `text-3xl` (30) |
| Script | Regular 20 / 34 | `text-lg leading-loose` (18 / 36) |
| Notes | heading icon + "หมายเหตุ" 14 Bold; body 16 / 26 | no icon; `text-sm` |
| UI text weight | Geist **Light 300** for header title (20), nav items (16), buttons (14), meta date (14), hints (12) | 400 everywhere |
| Sidebar | collapse icon at the sidebar's top-right next to "Channel's Tool" (20 Light); search fill `#d9d9d9`, border `#767676`; avatar 35 px `#2c2c2c` | no icon; search `#e6e6e6` |

---

## 4. File map

| File | Change | Responsibility |
|---|---|---|
| `web/src/components/ui/button.tsx` | modify | fix class bug; pressed scale; `loading` prop |
| `web/src/index.css` | modify | motion tokens, `.press`, skeleton shimmer, view-transition rules, reduced-motion |
| `web/src/main.tsx` | modify | Toaster mobile offset; mount `UploadProvider` |
| `web/src/lib/uploader.ts` | **create** | headless Uppy wired to `api.startUpload/sign/list/complete/abort` |
| `web/src/lib/uploads.tsx` | **create** | `UploadProvider`, `useUploads(clipId, purpose)` (React state over Uppy), `beforeunload` guard, offline pause |
| `web/src/components/UploadZone.tsx` | **create** | dropzone + upload rows (progress, pause, cancel, retry, error) per Figma |
| `web/src/components/media.tsx` | **create** | `useViewUrls`, `Thumb`, `Lightbox`, `VideoPlayer`, `downloadAll` |
| `web/src/components/bits.tsx` | modify | `FileTile` shows thumbnail and opens lightbox; delete `UploadDisabled`; `Skeleton` |
| `web/src/components/ClipCard.tsx` | modify | `variant="today"` so Home reuses it; `viewTransitionName` on title |
| `web/src/components/DayDrawer.tsx` | modify | bottom Drawer below md; optimistic move with view transition |
| `web/src/components/AppShell.tsx` | modify | sidebar collapse (D5); `viewTransition` on nav links |
| `web/src/api/queries.ts` | modify | `useAct` returns pending; optimistic helpers `useMoveClip`, `useReview`, `useDeleteClip` |
| `web/src/pages/Home.tsx` | modify | Figma gaps; skeletons |
| `web/src/pages/Calendar.tsx` | modify | directional slide on prev/next; skeleton per Figma |
| `web/src/pages/ClipDetail.tsx` | modify | creator: real refs, upload, submissions with play |
| `web/src/pages/ClipForm.tsx` | modify | ThaiDateField, select chevron, real refs + upload, D2 auto-save |
| `web/src/pages/Review.tsx` | modify | real player, download, download-all, storage line, approve moment |
| `web/src/lib/lib.test.ts` | modify | tests for new pure helpers |
| `web/.env.local` | **create, gitignored** | dev Supabase URL + publishable key |
| `docs/qa/2026-11-12/` | **create** | Figma vs app screenshot pairs, judge notes |
| `web/src/lib/status.ts`, 10 TSX files with hex classes | modify | colours through tokens (dark mode) |
| `web/public/theme.js`, `web/index.html` | **create** / modify | theme class before first paint (CSP-safe) |
| `web/src/lib/theme.ts` | **create** | `setTheme`, `useTheme` |
| `docs/buddy-handoff-2026-11-12.md` | **create** | what the backend must do or verify after the PR |
| `supabase/**` | **never** | out of scope (user rule) |

---

## Tasks (one branch `frontend-finish`, in this order, one commit per task, one PR at the end)

Order reason: tokens and button primitives first, because every later task writes classes against them.

### Task 1: Run the app against the dev project

**Files:** Create `web/.env.local` (gitignored by `*.local`).

- [ ] **Step 1: Branch.**
```bash
git switch main && git pull --ff-only && git switch -c frontend-finish
git branch -d ux-audit-fixes
```
- [ ] **Step 2: Env.** Get the dev project URL and publishable key (Supabase dashboard > project `webapp-clip-dev` (`hjitoifpfbiodoiyuoqm`) > Settings > API, or the Supabase MCP `get_publishable_keys`). Publishable key only, never the secret key.
```
VITE_SUPABASE_URL=https://hjitoifpfbiodoiyuoqm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```
- [ ] **Step 3: Login.** No backend scripts (they need the secret key). The user signs in on the dev app in the built-in browser pane with the dev owner account they already have; the creator account is made from the app's ผู้ใช้งาน page. Passwords are never typed by the agent or written to files.
- [ ] **Step 4: Seed a realistic week** through the app as the owner: about 12 clips this week, one day with 14 clips (dense state), 2 categories. This is normal app use, not backend work.
- [ ] **Step 5:** `npm run dev` in `web/`, open `http://localhost:5173`. Expected: Home loads with data, no console errors.
- [ ] **If no dev login is available:** continue anyway. Every task still ends with `npm run lint && npm test && npm run build` passing; screenshots that need data move to the handoff checklist for Buddy.

### Task 2: Baseline screenshots and the rest of the Figma diff

**Files:** Create `docs/qa/2026-11-12/README.md`, `docs/qa/2026-11-12/figma/*.png`, `docs/qa/2026-11-12/before/*.png`.

- [ ] **Step 1:** Export every frame in §3 to `docs/qa/2026-11-12/figma/<nodeId>.png` (Figma desktop export, or MCP `get_screenshot` once the limit resets; 5 frames already seen: `63:160`, `54:54`, `102:2240`, `103:2528`, `103:2720`). For exact copy, colours and font sizes, use Talk To Figma `get_node_info <frameId>` (one frame per call; the output is large, so read only the frames a task touches). Frames already read: `112:3691`, `112:3834`, `112:3977`.
- [ ] **Step 2:** Screenshot the matching app state at 1440x900, 768x1024, 375x812 (`resize_window` presets) to `before/<nodeId>.png`.
- [ ] **Step 3:** For each pair, append a row to the README table: `| frame | route + state | gaps |`. Add any gap not already in §2 as a checklist item under Task 14. This table is judge #1.

### Task 2b: Colour tokens with a dark theme (foundation for dark mode)

**Files:** Modify `web/src/index.css`, `web/src/lib/status.ts`, and the 10 files with hard-coded colours: `AppShell.tsx`, `bits.tsx`, `ClipCard.tsx`, `Calendar.tsx`, `ClipDetail.tsx`, `ClipForm.tsx`, `Home.tsx`, `Login.tsx`, `Review.tsx`, `Users.tsx`.

- [ ] **Step 1: Replace the literal `@theme` block** in `index.css` with variables that flip under `.dark`. Light values are today's tokens; dark values are from CLAUDE.md "Dark mode".
```css
:root {
  --c-bg: #ffffff; --c-ink: #1e1e1e; --c-sub: #5f5f5f; --c-line: #757575; --c-surface: #f5f5f5;
  --c-grid: #d9d9d9; --c-today: #eaf4ff; --c-note: #fff4d6; --c-note-line: #ffcc00;
  --c-brand: #0066cc; --c-brand-text: #0066cc; --c-danger: #d70015; --c-success: #1a7f3c;
  --c-warn-bg: #fff0e0; --c-warn-line: #ffb04d; --c-warn-text: #b35c00; --c-ok-bg: #e6f8ec;
  --c-chip: #eeeeee; --c-video: #1e1e1e; --c-avatar: #2c2c2c;
}
.dark {
  --c-bg: #1b1b1d; --c-ink: #f2f2f2; --c-sub: #a0a0a5; --c-line: #8e8e93; --c-surface: #262628;
  --c-grid: #3a3a3c; --c-today: #12304d; --c-note: #3a3112; --c-note-line: #ffcc00;
  --c-brand: #0088ff; --c-brand-text: #4da3ff; --c-danger: #ff383c; --c-success: #1a7f3c;
  --c-warn-bg: #3a2810; --c-warn-line: #ffb04d; --c-warn-text: #ffb04d; --c-ok-bg: #12301c;
  --c-chip: #3a3a3c; --c-video: #0e0e0f; --c-avatar: #3a3a3c;
  color-scheme: dark;
}
@theme inline {
  --font-sans: "Geist Variable", "Noto Sans Thai Variable", sans-serif;
  --color-bg: var(--c-bg); --color-ink: var(--c-ink); --color-sub: var(--c-sub); --color-line: var(--c-line);
  --color-surface: var(--c-surface); --color-grid: var(--c-grid); --color-today: var(--c-today);
  --color-note: var(--c-note); --color-note-line: var(--c-note-line); --color-brand: var(--c-brand);
  --color-brand-text: var(--c-brand-text); --color-danger: var(--c-danger); --color-success: var(--c-success);
  --color-warn-bg: var(--c-warn-bg); --color-warn-line: var(--c-warn-line); --color-warn-text: var(--c-warn-text);
  --color-ok-bg: var(--c-ok-bg); --color-chip: var(--c-chip); --color-video: var(--c-video); --color-avatar: var(--c-avatar);
  --radius-card: 10px;
}
```
Also point shadcn's variables at them in both themes so dialogs, menus, inputs and sheets follow: `--background: var(--c-bg); --foreground: var(--c-ink); --card/--popover: var(--c-bg)` (dark popover `var(--c-surface)`), `--border/--input: var(--c-grid)`, `--primary: var(--c-brand)`, `--muted-foreground: var(--c-sub)`, `--ring: var(--c-brand)`. Body: `background: var(--c-bg); color: var(--c-ink)`. The success green on `--c-ok-bg` in dark: read the "Dark — Clip Detail — Owner · อนุมัติแล้ว · เลิกทำ" frame with `get_node_info` and use its chip text colour (likely a lighter green); add it as `--c-success-text`.
- [ ] **Step 2: Swap literals for tokens** (exact mapping, grep shows every hit):
```bash
grep -rnE "\[#[0-9a-fA-F]{3,6}\]|bg-white|text-white|bg-black" web/src --include=*.tsx | grep -v components/ui
```
`bg-white` → `bg-bg` (cards, inputs, tab bar, login card) · `bg-[#fff0e0]` → `bg-warn-bg` · `border-[#ffb04d]` → `border-warn-line` · `text-[#b35c00]` / `text-[#ffb04d]` → `text-warn-text` · `bg-[#1a7f3c]` → `bg-success` · `text-[#0066cc]` → `text-brand-text` · `bg-[#1e1e1e]` (video) → `bg-video` · `bg-[#e6e6e6]` (search) → `bg-grid` (also the Figma value) · `border-[#ff9500]` → `border-warn-line`. `text-white` stays where it sits on brand, danger, success, video or a category colour (those fills do not change in dark). `bg-black` stays on scrims and the lightbox.
`status.ts`: `todo: 'bg-chip text-sub'`, `submitted: 'bg-today text-brand-text'`, `approved: 'bg-ok-bg text-success'` (dark: `text-success-text`), `revision: 'bg-warn-bg text-warn-text'`. Users role pill likewise.
- [ ] **Step 3: Contrast test** in `lib.test.ts` with the existing `contrast()`:
```ts
it('dark and light text tokens meet 4.5:1 on their backgrounds', () => {
  const pairs = [['#1e1e1e', '#ffffff'], ['#5f5f5f', '#ffffff'], ['#5f5f5f', '#f5f5f5'], ['#f2f2f2', '#1b1b1d'],
    ['#a0a0a5', '#1b1b1d'], ['#a0a0a5', '#262628'], ['#4da3ff', '#1b1b1d'], ['#ffb04d', '#3a2810'], ['#b35c00', '#fff0e0']]
  for (const [fg, bg] of pairs) expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
})
```
- [ ] **Step 4:** Light mode must look identical to before (spot-check Home, Calendar, clip detail). Commit `refactor: colour tokens with a dark theme`.

### Task 3: Button fix, pressed state, hover state, pending state

**Files:** Modify `web/src/components/ui/button.tsx`, `web/src/index.css`.

- [ ] **Step 1: Fix the class string.** In `buttonVariants` base string replace
`max-md:min-h-11 max-md:min-w-11items-center` with `max-md:min-h-11 max-md:min-w-11 items-center`
and replace `active:not-aria-[haspopup]:translate-y-px` with `press`.

- [ ] **Step 2: Motion tokens and press utility** at the end of `web/src/index.css`:
```css
@theme {
  --ease-out-quint: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-quint: cubic-bezier(0.64, 0, 0.78, 0);
  --duration-press: 100ms;
  --duration-state: 200ms;
  --duration-layout: 320ms;
}

/* Feedback on pointer-down, not on click (apple-design §1). */
@utility press {
  transition: transform var(--duration-press) var(--ease-out-quint), background-color var(--duration-state), opacity var(--duration-state);
  &:active:not(:disabled):not([aria-haspopup]) { transform: scale(0.97); }
}

@utility skeleton {
  background: linear-gradient(90deg, var(--color-surface) 25%, var(--color-grid) 50%, var(--color-surface) 75%) 0 0 / 200% 100%;
  animation: shimmer 1.4s linear infinite;
  border-radius: var(--radius-card);
}
@keyframes shimmer { to { background-position: -200% 0; } }

@media (prefers-reduced-motion: reduce) {
  *, ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
  .skeleton { animation: none; }
}
```
Reduced motion keeps colour and opacity changes (they are instant, not removed), so state is still visible.

- [ ] **Step 3: `loading` prop.** In `button.tsx`, extend `Button`:
```tsx
import { Loader2 } from 'lucide-react'

function Button({ className, variant = 'default', size = 'default', loading = false, children, disabled, ...props }:
  ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { loading?: boolean }) {
  return (
    <ButtonPrimitive data-slot="button" aria-busy={loading || undefined} disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))} {...props}>
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </ButtonPrimitive>
  )
}
```
(Keep the existing primitive import and props names; read the file first and only add `loading`.)

- [ ] **Step 4: Card links press too.** Add `press` to the `className` of `ClipCard` (`ClipCard.tsx`), Home cards, Search result links, Calendar day buttons and the mobile tab bar links.
- [ ] **Step 4b: Hover feedback** (pointer devices only, so touch never shows a stuck hover). Add to `index.css`:
```css
/* One hover language: a 150 ms tint, no lift, no shadow jump. */
@custom-variant hover-pointer (@media (hover: hover) and (pointer: fine));
@utility hover-tint {
  transition: background-color 150ms var(--ease-out-quint), border-color 150ms var(--ease-out-quint);
  @media (hover: hover) and (pointer: fine) { &:hover { background-color: color-mix(in oklab, var(--c-ink) 5%, transparent); } }
}
```
  Apply, with the exact list (grep each file for `<Link`, `<NavLink`, `<button`):
  - Cards and rows (`ClipCard`, Home today/recent/attention cards, Search results, Users rows, Categories rows, Review submission rows, upload rows): `hover-tint` + `cursor-pointer`; a card's border goes `hover-pointer:border-ink/40`.
  - Calendar day header buttons, month cells, mobile day pills, DayDrawer filter chips: `hover-tint`.
  - Sidebar nav items not active: `hover-tint`; active stays brand.
  - Text links ("เปิดปฏิทิน", "ดูทั้งหมด", "ดูทั้งวัน", "ดูเพิ่มอีก"): `hover-pointer:underline underline-offset-4`.
  - `FileTile`: image `hover-pointer:brightness-95`, the × delete fades in from 70 % to 100 % opacity.
  - Buttons: base-nova variants already have `hover:` fills; check each variant in light and dark and fix any that only change in one theme (`outline` uses `hover:bg-muted`, make sure `--muted` is set in `.dark`).
  - Focus: `focus-visible` ring stays (`ring-brand/50`) and is never removed by hover styles.
- [ ] **Step 5: Verify.** In the browser at 375 px, an icon-only button is 44x44 and its icon is centered (`getComputedStyle(btn).alignItems === 'center'`). Holding the mouse down on "บันทึก" shows the scale before release.
- [ ] **Step 6: Commit** `fix: button alignment and 44px width on phones; pressed state on pointer-down`.

### Task 4: Pending everywhere, toasts above the tab bar

**Files:** Modify `web/src/main.tsx`, every caller of `useAct`.

- [ ] **Step 1:** `main.tsx`: `<Toaster position="bottom-center" theme="light" mobileOffset={{ bottom: 80 }} />` (64 px tab bar + 16 px gap).
- [ ] **Step 2:** Replace every `disabled={x.isPending}` on a submit-like Button with `loading={x.isPending}`: `ClipForm.tsx` (บันทึก, บันทึกและเพิ่มต่อ), `Review.tsx` (อนุมัติ, ส่งคำขอแก้ไข), `Users.tsx` (create, reset, delete), `Categories.tsx` (save, delete), `ChangePasswordDialog.tsx`, `CopyDialog.tsx`, `Login.tsx` (keep its text swap and add `loading`).
```bash
grep -rn "isPending" web/src --include=*.tsx
```
Expected after the change: every hit is either `loading=` or a non-button guard.
- [ ] **Step 3: ConfirmDialog stays open while working.** Today it calls `onConfirm(); onClose()` at once, so a failed delete has already closed. Change `bits.tsx` `ConfirmDialog` to accept `onConfirm: () => Promise<unknown> | void` and a `loading` flag:
```tsx
<Button className="bg-danger text-white hover:bg-danger/90" loading={props.loading}
  onClick={async () => { try { await props.onConfirm(); props.onClose() } catch { /* toast shown by useAct; keep dialog open */ } }}>
  {props.confirm}
</Button>
```
Callers pass `onConfirm={() => remove.mutateAsync(id)}` and `loading={remove.isPending}`.
- [ ] **Step 4: Commit** `feat: pending state on every action; toasts clear the mobile tab bar`.

### Task 5: Skeletons instead of "กำลังโหลด..."

**Files:** Modify `bits.tsx`, `Home.tsx`, `Calendar.tsx`, `ClipDetail.tsx`, `ClipForm.tsx`, `Search.tsx`.

- [ ] **Step 1:** Add to `bits.tsx`:
```tsx
export const Skeleton = ({ className = '' }: { className?: string }) => <div aria-hidden className={`skeleton ${className}`} />
export const Loading = ({ children }: { children: ReactNode }) => <div role="status" aria-label="กำลังโหลด">{children}</div>
```
- [ ] **Step 2:** Replace each text loader with the shape of the content it stands for (match Figma `102:1935` for week, `108:9814` for mobile):
  - Week column: 2 cards `<Skeleton className="h-20" />` per day.
  - Home today: 2 cards `h-28`; week strip: 7 cells `h-24`.
  - Clip detail: title bar `h-9 w-2/3`, script `h-64`, right column `h-32` + `h-40`.
  - Search: 3 rows `h-20` while `isFetching`.
- [ ] **Step 3:** Show skeletons only after 150 ms so fast loads do not flash: wrap in a `useDelayed(isPending, 150)` hook in `bits.tsx`:
```tsx
export function useDelayed(on: boolean, ms: number) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!on) { setShow(false); return }
    const t = setTimeout(() => setShow(true), ms)
    return () => clearTimeout(t)
  }, [on, ms])
  return show
}
```
- [ ] **Step 4: Commit** `feat: content-shaped skeletons`.

---

### Task 6: Uploader core (Uppy headless)

**Files:** Create `web/src/lib/uploader.ts`; modify `web/package.json`.

- [ ] **Step 1: Install** (pin the exact versions npm resolves; check they are at least two weeks old).
```bash
cd web && npm i @uppy/core @uppy/aws-s3
```
- [ ] **Step 2: Check names against the installed types** before writing code: `node_modules/@uppy/aws-s3/lib/index.d.ts` must have `shouldUseMultipart`, `getChunkSize`, `getUploadParameters`, `createMultipartUpload`, `signPart`, `listParts`, `completeMultipartUpload`, `abortMultipartUpload`. If a name differs in the installed major, use the installed one; the mapping below stays the same.
- [ ] **Step 3: Write `web/src/lib/uploader.ts`:**
```ts
// One Uppy instance for the whole app, so an upload keeps going when the user leaves the clip page.
// The browser sends bytes straight to R2 through presigned URLs from the media-upload Edge Function;
// the server marks the row ready only after `complete` checks the object (see api/index.ts).
import Uppy from '@uppy/core'
import AwsS3 from '@uppy/aws-s3'
import * as api from '@/api/index'
import type { ClipMedia } from '@/lib/types'

// Must equal MULTIPART_THRESHOLD and PART_BYTES in supabase/functions/_shared/media.ts, or the
// server's part_count will not match the parts Uppy sends.
export const MULTIPART_AT = 100 * 1024 ** 2
export const PART_BYTES = 50 * 1024 ** 2

export type UploadMeta = { clipId: string; purpose: ClipMedia['purpose']; mediaId?: string; single?: boolean }

export function createUploader(onReady: (m: ClipMedia) => void) {
  const uppy = new Uppy<UploadMeta, Record<string, never>>({ autoProceed: true })
  const startArgs = (f: { name?: string; type?: string; size: number | null }) =>
    ({ name: f.name ?? 'file', type: f.type ?? '', size: f.size ?? 0 })

  uppy.use(AwsS3, {
    shouldUseMultipart: (file) => (file.size ?? 0) >= MULTIPART_AT,
    getChunkSize: () => PART_BYTES,
    limit: 3,

    async getUploadParameters(file) {
      const s = await api.startUpload(file.meta.clipId, file.meta.purpose, startArgs(file))
      if (s.mode !== 'single') throw new Error('เริ่มอัปโหลดไม่สำเร็จ ลองอีกครั้ง')
      uppy.setFileMeta(file.id, { mediaId: s.media.id, single: true })
      return { method: 'PUT', url: s.url, headers: s.headers }
    },

    async createMultipartUpload(file) {
      const s = await api.startUpload(file.meta.clipId, file.meta.purpose, startArgs(file), { multipart: true })
      if (s.mode !== 'multipart') throw new Error('เริ่มอัปโหลดไม่สำเร็จ ลองอีกครั้ง')
      uppy.setFileMeta(file.id, { mediaId: s.media.id })
      return { uploadId: s.upload_id, key: s.media.id }
    },

    async signPart(_file, { uploadId, key, partNumber }) {
      const urls = await api.signUploadParts(key, uploadId, [partNumber])
      return { url: urls[partNumber] }
    },

    async listParts(_file, { uploadId, key }) {
      return (await api.listUploadParts(key, uploadId)).map((p) => ({ PartNumber: p.part_number, ETag: p.etag, Size: p.size }))
    },

    async completeMultipartUpload(_file, { uploadId, key, parts }) {
      const media = await api.completeUpload(key, {
        uploadId,
        parts: parts.map((p) => ({ part_number: p.PartNumber!, etag: p.ETag! })),
      })
      onReady(media)
      return {}
    },

    async abortMultipartUpload(_file, { uploadId, key }) {
      await api.abortUpload(key, uploadId)
    },
  })

  // A single PUT has no "complete" hook in Uppy: confirm with the server here. If the server
  // rejects the file (size/type differ from init), surface it as an upload error.
  uppy.on('upload-success', async (file) => {
    if (!file?.meta.single || !file.meta.mediaId) return
    try {
      onReady(await api.completeUpload(file.meta.mediaId))
    } catch (e) {
      uppy.emit('upload-error', file, e as Error)
    }
  })

  // Cancelling a single upload leaves a pending row; drop it. Multipart is aborted by the plugin.
  uppy.on('file-removed', (file) => {
    if (file.meta.single && file.meta.mediaId && file.progress.uploadComplete !== true)
      void api.abortUpload(file.meta.mediaId).catch(() => {})
  })

  return uppy
}
```
- [ ] **Step 4: Test the constants against the server** in `web/src/lib/lib.test.ts` (the shared file lives in `supabase/`, so read it as text to keep the web build free of Deno imports):
```ts
import { readFileSync } from 'node:fs'
import { MULTIPART_AT, PART_BYTES } from './uploader'

describe('uploader', () => {
  it('uses the same multipart threshold and part size as the server', () => {
    const src = readFileSync(new URL('../../../supabase/functions/_shared/media.ts', import.meta.url), 'utf8')
    const mb = (name: string) => Number(src.match(new RegExp(`${name}\\s*=\\s*(\\d+)\\s*\\*\\s*1024\\s*\\*\\*\\s*2`))?.[1])
    expect(mb('MULTIPART_THRESHOLD') * 1024 ** 2).toBe(MULTIPART_AT)
    expect(mb('PART_BYTES') * 1024 ** 2).toBe(PART_BYTES)
  })
})
```
Run `npm test` in `web/`. Expected: FAIL first if the regex does not match the server's expression; adjust the regex to the real line in `_shared/media.ts`, not the constants.
- [ ] **Step 5: Do not touch the bucket.** Add to the handoff: "dev bucket CORS must expose `ETag` like prod (`docs/deploy.md:42`), or multipart uploads fail at `completeMultipartUpload`."
- [ ] **Step 6: Commit** `feat: headless Uppy uploader on the media-upload function`.

### Task 7: Upload state for React, survive navigation, survive offline

**Files:** Create `web/src/lib/uploads.tsx`; modify `web/src/main.tsx`.

- [ ] **Step 1: Write `uploads.tsx`:**
```tsx
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { uploadProblem } from '@/lib/media'
import type { ClipMedia } from '@/lib/types'
import { createUploader } from './uploader'

type Uploader = ReturnType<typeof createUploader>
const Ctx = createContext<Uploader | null>(null)

export function UploadProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const uppy = useMemo(() => createUploader((m) => {
    void qc.invalidateQueries({ queryKey: ['media', m.clip_id] })
    void qc.invalidateQueries({ queryKey: ['clip', m.clip_id] }) // status may move to submitted
  }), [qc])

  useEffect(() => {
    // Leaving the tab mid-upload loses it; the browser asks first.
    const guard = (e: BeforeUnloadEvent) => { if (uppy.getFiles().some((f) => !f.progress.uploadComplete && !f.error)) e.preventDefault() }
    // Figma 112:3691 shows the row retrying on its own ("เน็ตหลุด · กำลังลองใหม่ (ครั้งที่ N)"), so
    // offline only flags the rows; Uppy's retryDelays do the retrying and 'online' kicks it at once.
    const offline = () => setOffline(true)
    const online = () => { setOffline(false); void uppy.retryAll() }
    window.addEventListener('beforeunload', guard)
    window.addEventListener('offline', offline)
    window.addEventListener('online', online)
    return () => { window.removeEventListener('beforeunload', guard); window.removeEventListener('offline', offline); window.removeEventListener('online', online); uppy.destroy() }
  }, [uppy])

  return <Ctx.Provider value={uppy}><Offline.Provider value={offline}>{children}</Offline.Provider></Ctx.Provider>
}
// Also in UploadProvider: `const [offline, setOffline] = useState(!navigator.onLine)` and at module
// level `const Offline = createContext(false)`; useUploads reads it to mark rows as retrying.

export type UploadRow = { id: string; name: string; size: number; sent: number; percent: number; paused: boolean; error: string | null; done: boolean }

export function useUploads(clipId: string, purpose: ClipMedia['purpose']) {
  const uppy = useContext(Ctx)
  if (!uppy) throw new Error('useUploads needs UploadProvider')
  const files = useSyncExternalStore(
    (cb) => { uppy.on('state-update', cb); return () => uppy.off('state-update', cb) },
    () => uppy.getState().files,
  )
  const rows: UploadRow[] = Object.values(files)
    .filter((f) => f.meta.clipId === clipId && f.meta.purpose === purpose && !f.progress.uploadComplete)
    .map((f) => ({
      id: f.id, name: f.name ?? '', size: f.size ?? 0, sent: f.progress.bytesUploaded || 0,
      percent: f.progress.percentage ?? 0, paused: !!f.isPaused, error: f.error ? String(f.error) : null, done: false,
    }))

  // Files the client already knows are bad never reach the server; they show as error rows.
  const add = (list: FileList | File[]) => {
    for (const file of Array.from(list)) {
      const id = uppy.addFile({ name: file.name, type: file.type, data: file, meta: { clipId, purpose } })
      const problem = uploadProblem(file)
      if (problem) uppy.setFileState(id, { error: problem })
    }
  }
  return {
    rows,
    add,
    pause: (id: string) => uppy.pauseResume(id),
    retry: (id: string) => void uppy.retryUpload(id),
    remove: (id: string) => uppy.removeFile(id),
  }
}
```
Note: `autoProceed` would start the bad file too. In `add`, call `uppy.addFile` only when `uploadProblem` is null, and keep bad files in a local `useState<{ id, name, problem }[]>` inside `UploadZone` instead (simpler than fighting Uppy's state). Decide while implementing; the visible behaviour is the same: a red row, no network call.
- [ ] **Step 2:** `main.tsx`: wrap `<App />` with `<UploadProvider>` inside `QueryClientProvider`.
- [ ] **Step 3: Commit** `feat: uploads survive navigation and network loss`.

### Task 8: UploadZone component (Figma `102:2240`, `103:2720`, `112:3691`, `112:3834`)

**Files:** Create `web/src/components/UploadZone.tsx`; delete `UploadDisabled` from `bits.tsx`.

- [ ] **Step 1: Write the component.** Behaviour:
  - A `<label>` wrapping a hidden `<input type="file" multiple accept={ACCEPT}>`; dashed border; `onDragOver` sets an `over` state (border turns brand, background `bg-today`, 150 ms); `onDrop` calls `add(e.dataTransfer.files)`. Keyboard: the label is focusable through the input (`sr-only`, not `hidden`), Enter/Space opens the picker.
  - Copy (two variants by `purpose`):
    - reference: "ลากรูปหรือวิดีโอมาวาง หรือคลิกเพื่อเลือกไฟล์" / "รูปภาพ และวิดีโอ MP4 / MOV ไม่เกิน 2 GB"
    - submission: "ลากไฟล์มาวาง หรือ คลิกเพื่อเลือกไฟล์" / "ถ้าเน็ตหลุดระหว่างอัป จะอัปต่อจากเดิมได้"
  - Row in progress (`bg-today`, rounded-card): bold name, right "`{formatSize(sent)} / {formatSize(size)} · {percent}%`", 6 px bar (`bg-brand`, width transitions 200 ms linear), actions "หยุดชั่วคราว" / "อัปต่อ" (brand) and "ยกเลิก" (sub). `aria-live="polite"` region announces "อัปโหลด {name} เสร็จแล้ว" and errors.
  - Row retrying (offline flag from Task 7, or Uppy `upload-retry` event; count retries per file): orange spec from §3 table, right text `เน็ตหลุด · กำลังลองใหม่ (ครั้งที่ {n})`, same actions as in progress. The colour change itself is the feedback; no toast.
  - Row failed after retries (server/network error): red spec from §3, bar frozen, right text `อัปไม่สำเร็จที่ {percent}%`, actions "อัปต่อจากเดิม" (`uppy.retryUpload`, multipart resumes from `listParts`) and "ยกเลิกไฟล์นี้".
  - Row refused before upload (`uploadProblem`, Figma `103:2720`, `102:2384`): red border, name + "ลบออก" right, red message under it ("ไม่รองรับไฟล์ชนิดนี้ อัปได้เฉพาะรูปภาพและวิดีโอ" / "วิดีโอใหญ่เกิน 2 GB"). Read `102:2384` with `get_node_info` for the exact over-size copy before writing it.
  - When a row completes it fades out (opacity 200 ms) while the new file appears in the list above (it arrives from the `media` refetch); the new tile/row gets a one-time `bg-today` flash that fades over 1.2 s (`@starting-style` on a `data-new` attribute), so the eye follows the file to where it landed.
- [ ] **Step 2:** Pure helper for the progress label, tested:
```ts
// web/src/lib/media.ts
export const progressLabel = (sent: number, size: number) =>
  `${formatSize(sent)} / ${formatSize(size)} · ${size ? Math.floor((sent / size) * 100) : 0}%`
```
```ts
it('labels upload progress', () => {
  expect(progressLabel(1.2 * 1024 ** 3, 1.8 * 1024 ** 3)).toBe('1.2 GB / 1.8 GB · 66%')
})
```
Run `npm test`; expected FAIL then PASS after adding the helper.
- [ ] **Step 3: Commit** `feat: upload zone with progress, pause, retry and inline errors`.

### Task 9: Viewing: thumbnails, lightbox, video player, downloads

**Files:** Create `web/src/components/media.tsx`; modify `bits.tsx` (`FileTile`), `ClipDetail.tsx`, `Review.tsx`, `ClipForm.tsx`.

- [ ] **Step 1: `useViewUrls`** (one batched call per opened clip, cached 50 min because URLs live 60):
```tsx
export function useViewUrls(ids: string[], download = false) {
  const key = [...ids].sort()
  return useQuery({
    queryKey: ['view', download, key],
    queryFn: () => api.viewUrls(key, { download }),
    enabled: key.length > 0,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
  })
}
```
Called once per page with all ready media ids of the clip (refs + submissions), never from cards on the week page (CLAUDE.md rule).
- [ ] **Step 2: `FileTile`** takes an optional `url`. Image: `<img src={url} loading="lazy" decoding="async" className="size-full object-cover">` with the skeleton behind it until `onLoad`; caption under the tile like Figma `103:2720`. Video: dark tile, play icon, name. Whole tile is a `<button>` that opens the lightbox at that index. Keep the days-left line. The delete × stays a separate button (stopPropagation).
- [ ] **Step 3: `Lightbox`** = base-ui `Dialog` full-screen, black 90 % backdrop. Shows image (`object-contain`) or `<video controls autoPlay playsInline>`; ← → keys and on-screen chevrons move between files; counter "2 / 6"; Esc closes. Motion: opens by scaling from the tile's rect (`transform-origin` set from `getBoundingClientRect()` of the clicked tile, 320 ms `--ease-out-quint`), closes back to it (apple-design §7: exit along the entry path). Under reduced motion: fade only.
- [ ] **Step 4: `VideoPlayer`** in `Review.tsx` replaces the fake box: `<video key={current.id} src={urls[current.id]} controls preload="metadata" className="aspect-video w-full rounded-card bg-black" />` with the "รอบ N · name" caption overlaid top-left. ProRes (`!isPlayable(mime)`): no player; the row's "ดาวน์โหลด" is enabled.
- [ ] **Step 5: Downloads.** Single: `viewUrls([id], { download: true })` then `location.assign(url)` (the URL carries `Content-Disposition` with the Thai name). All: fetch the download URLs in one call, then click a hidden `<a>` per file 400 ms apart (browsers block bursts); button shows `loading` until the last one starts and then "เริ่มดาวน์โหลด N ไฟล์แล้ว" toast. Wire to: `Review.tsx` "ดาวน์โหลดทั้งหมด", the expiring banner in `ClipForm.tsx:302`, and Home's expiring list.
- [ ] **Step 6:** Creator detail, to the §3 spec table: reference card header "ไฟล์อ้างอิง {n} ไฟล์" + "แตะรูปเพื่อดูขยาย", 3-column tiles, footer "ไฟล์อ้างอิงจะถูกลบอัตโนมัติใน {min days} วัน · ดาวน์โหลดไว้ก่อนได้"; submission rows with the 32 px play button (opens the lightbox on that video), "{size} · ส่งเมื่อ {d MMM HH:mm}", right "ลบใน N วัน"; withdraw as a full-width red outline button under its row; hint text switches between the withdraw copy (while any own file can be withdrawn) and "ส่งแล้วลบหรือแก้ไม่ได้ ถ้าต้องแก้ให้ส่งเป็นรอบใหม่". Header right "ไฟล์ตัดต่อเสร็จ · MP4 ≤ 2 GB". `<UploadZone purpose="submission" />` replaces `UploadDisabled`. The withdraw minutes count down live (re-render every 30 s with a `setInterval` in the section), and the button disappears with a 200 ms fade when it reaches 0.
- [ ] **Step 7:** Owner review: header right `ใช้พื้นที่ {formatSize(sum of this clip's submissions)} · ลบอัตโนมัติหลัง 30 วัน`; "ดาวน์โหลดทั้งหมด" outline small button under the heading; rows show `{size} · {d MMM HH:mm} · ลบใน N วัน`.
- [ ] **Step 8: Commit** `feat: thumbnails, lightbox, video playback and downloads from R2`.

### Task 10: Reference uploads in the clip form, including new clips (D2)

**Files:** Modify `web/src/pages/ClipForm.tsx`.

- [ ] **Step 1:** Reference grid: 2 columns of `FileTile`, then `<UploadZone purpose="reference" />` (owner edit frame `103:2528` shows it as an "อัปโหลดรูป" grid cell; add-clip `103:2720` shows a full-width zone: use the full-width zone in both, and note the edit-frame difference in the QA table as an accepted exception if it reads better, or match it exactly; pick at review).
- [ ] **Step 2: New clip.** `UploadZone` accepts `ensureClipId: () => Promise<string | null>`. For a new clip it runs `submit()` without navigating: if the title is empty it sets `titleError`, focuses `#title` and returns null (the files stay selected in a local pending list with the hint "กรอกหัวข้อก่อนแนบไฟล์"); otherwise it creates the clip, `nav(/clips/{id}, { replace: true })`, and returns the id so the files start uploading. The upload continues across the route change because the uploader lives at root (Task 7).
- [ ] **Step 3:** Footer line under the zone: "ไฟล์อ้างอิงจะถูกลบอัตโนมัติใน 30 วัน · ดาวน์โหลดไว้ก่อนได้" (29 on an existing clip = min days left of its refs).
- [ ] **Step 4: Commit** `feat: reference uploads on new and existing clips`.

---

**Motion thesis** (applies to Tasks 11 to 13b). Motion thesis (impeccable animate): this is an Operate surface, so motion carries feedback and continuity, never page-load choreography. One authored moment: **approval**, the end of the brief-to-done loop (peak-end), where the status chip turns green with a check. Everything else is fast and quiet: 100 ms press, 200 ms state, 320 ms layout, exits faster than entrances, `--ease-out-quint`, no bounce (nothing here is flicked, apple-design §4), except the mobile day drawer which follows the finger.

### Task 11: Optimistic writes with visible results

**Files:** Modify `web/src/api/queries.ts`, `DayDrawer.tsx`, `Review.tsx`, `ClipForm.tsx`.

- [ ] **Step 1: `optimistic` helper** in `queries.ts`:
```ts
// Patch every cached query that holds clip rows, run fn, roll back on error. The UI changes in
// the same frame as the press; the server answer only confirms it.
export function useOptimistic<A>(fn: (a: A) => Promise<unknown>, patch: (rows: ClipCardRow[], a: A) => ClipCardRow[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onMutate: async (a: A) => {
      await qc.cancelQueries({ queryKey: ['clips'] })
      const before = qc.getQueriesData<ClipCardRow[]>({ queryKey: ['clips'] })
      withTransition(() => qc.setQueriesData<ClipCardRow[]>({ queryKey: ['clips'] }, (rows) => rows && patch(rows, a)))
      return { before }
    },
    onError: (e: Error, _a, ctx) => {
      ctx?.before.forEach(([k, v]) => qc.setQueryData(k, v))
      toast.error(e.message)
    },
    onSettled: () => qc.invalidateQueries(),
  })
}

// View Transitions animate DOM changes caused by the update (FLIP for free); no-op where unsupported.
export function withTransition(update: () => void) {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return update()
  document.startViewTransition(() => flushSync(update))
}
```
(`flushSync` from `react-dom` so React commits inside the transition callback.)
- [ ] **Step 2: Move up/down** (`DayDrawer.tsx`): `useOptimistic(({id,dir}) => api.moveClip(id, dir), (rows, {id, dir}) => swapInDay(rows, id, dir))`. Each card wrapper gets `style={{ viewTransitionName: \`clip-${c.id}\` }}` so the two cards slide past each other. Pure `swapInDay` in `web/src/lib/order.ts`, tested:
```ts
export function swapInDay<T extends { id: string; date: string; position: number }>(rows: T[], id: string, dir: -1 | 1): T[] {
  const me = rows.find((r) => r.id === id)
  if (!me) return rows
  const day = rows.filter((r) => r.date === me.date).sort((a, b) => a.position - b.position)
  const i = day.findIndex((r) => r.id === id)
  const other = day[i + dir]
  if (!other) return rows
  return rows
    .map((r) => (r.id === me.id ? { ...r, position: other.position } : r.id === other.id ? { ...r, position: me.position } : r))
    .sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position)
}
```
```ts
it('swaps a clip with its neighbour in the same day only', () => {
  const r = [{ id: 'a', date: 'd1', position: 0 }, { id: 'b', date: 'd1', position: 1 }, { id: 'c', date: 'd2', position: 0 }]
  expect(swapInDay(r, 'b', -1).map((x) => x.id)).toEqual(['b', 'a', 'c'])
  expect(swapInDay(r, 'a', -1)).toEqual(r)
  expect(swapInDay(r, 'c', 1)).toEqual(r)
})
```
- [ ] **Step 3: Delete clip:** `useDeleteClip` removes the row from cache through `withTransition` before the request (card collapses), restores on error; "เลิกทำ" reinserts through `withTransition` (card grows back in place).
- [ ] **Step 4: Approve (the authored moment).** `reviewClip` optimistic on `['clip', id]` and `['clips']`: the `StatusChip` gets `view-transition-name: status-{id}`; the green chip enters with a check icon that draws in (`stroke-dashoffset` 240 ms) and the chip's background crossfades from blue to green (200 ms). The approve button changes to a disabled "อนุมัติแล้ว ✓". Undo reverses through the same transition. Request-changes: the reason box collapses (grid-rows 0fr, 200 ms) and the orange chip appears the same way.
- [ ] **Step 5: Save** keeps the toast and also flips the บันทึก button label to "บันทึกแล้ว ✓" for 1.5 s (state, not animation), so the answer is where the eye is.
- [ ] **Step 6:** `npm test`; commit `feat: optimistic move, delete, approve with view transitions`.

### Task 12: Navigation continuity

**Files:** Modify `ClipCard.tsx`, Home cards, `ClipDetail.tsx`, `ClipForm.tsx`, `AppShell.tsx`, `Calendar.tsx`, `index.css`.

- [ ] **Step 1:** Add `viewTransition` to every `<Link>`/`NavLink` and to `nav()` calls between routes (`nav(path, { viewTransition: true })`). React Router wraps the navigation in `document.startViewTransition`.
- [ ] **Step 2:** Root crossfade in `index.css`:
```css
::view-transition-old(root) { animation: 120ms var(--ease-in-quint) both fade-out; }
::view-transition-new(root) { animation: 200ms var(--ease-out-quint) both fade-in; }
@keyframes fade-out { to { opacity: 0; } }
@keyframes fade-in { from { opacity: 0; } }
```
- [ ] **Step 3: Shared title.** Card title `<b style={{ viewTransitionName: \`title-${clip.id}\` }}>` and the detail `<h1>` / title input get the same name. Only one element per name may exist on a page: Home can show the same clip twice (งานของฉัน and วันนี้); give the name only on the card that was clicked (set a module-level `lastClicked` id on pointer-down and apply the name when `id === lastClicked`).
- [ ] **Step 4: Calendar direction.** Before `step(n)`, set `document.documentElement.dataset.dir = n > 0 ? 'next' : 'prev'`, wrap `setParams` in `withTransition`, and name the week grid `view-transition-name: cal`:
```css
::view-transition-old(cal) { animation: 160ms var(--ease-in-quint) both slide-out; }
::view-transition-new(cal) { animation: 240ms var(--ease-out-quint) both slide-in; }
@keyframes slide-out { to { opacity: 0; transform: translateX(calc(var(--d, 1) * -24px)); } }
@keyframes slide-in { from { opacity: 0; transform: translateX(calc(var(--d, 1) * 24px)); } }
:root[data-dir='prev'] { --d: -1; }
```
24 px, not a full-width slide: it says "later/earlier" without moving the whole page (vestibular-safe; reduced motion collapses it to an instant swap).
- [ ] **Step 5: Commit** `feat: route crossfade, shared clip title, directional week change`.

### Task 13: Drawers and sheets (D4, D5)

**Files:** Modify `DayDrawer.tsx`, `AppShell.tsx`, `ui/sheet.tsx`.

- [ ] **Step 1:** Below `md`, `DayDrawer` renders base-ui `Drawer` from the bottom (read `node_modules/@base-ui/react/drawer/*.d.ts` for part names: root, backdrop, popup/content, handle). Height 85 dvh, rounded top 16 px, visible grab handle (36x4 px), swipe down to close (the component tracks the finger and uses release velocity; do not reimplement). From `md` keep the right `Sheet`.
- [ ] **Step 2:** `sheet.tsx` timing: enter 320 ms `--ease-out-quint`, exit 200 ms `--ease-in-quint` (exit faster), translate the full panel width instead of 2.5 rem so it visibly comes from the edge it belongs to.
- [ ] **Step 3: Sidebar collapse (D5).** `AppShell`: header gets a `PanelLeft` icon button at `lg+` toggling `collapsed` (localStorage key `sidebar-collapsed`, read in a try/catch); when collapsed render the existing `<Sidebar rail />` in the 64 px aside. Width animates 240 ms (`transition-[width]` on the aside only; content reflows once).
- [ ] **Step 4: Commit** `feat: bottom day sheet with swipe on phones; collapsible sidebar`.

### Task 13b: Dark mode toggle, no flash, dark-specific details

**Files:** Create `web/public/theme.js`; modify `web/index.html`, `AppShell.tsx`, `main.tsx`, `index.css`.

- [ ] **Step 1: Apply the theme before first paint.** The CSP (`web/public/_headers`) has `script-src 'self'`, so no inline script: a tiny same-origin file loaded synchronously in `<head>` before the module script.
```js
// web/public/theme.js: set the theme class before paint so a dark user never sees a white flash.
try {
  const t = localStorage.getItem('theme')
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
} catch { /* storage blocked: follow light default */ }
```
```html
<script src="/theme.js"></script>
```
- [ ] **Step 2: Toggle** in the header right (Figma Moon position, `112:3843`): icon button `Moon` / `Sun`, `aria-label` "โหมดมืด" / "โหมดสว่าง". Click cycles light ↔ dark and stores it; a "ตามระบบ" item is not needed in the UI (clearing storage returns to system). While no choice is stored, follow `matchMedia('(prefers-color-scheme: dark)')` changes live. Also in the mobile menu sheet and the tablet rail.
```ts
// web/src/lib/theme.ts
export function setTheme(dark: boolean) {
  const apply = () => document.documentElement.classList.toggle('dark', dark)
  try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch { /* per-browser convenience only */ }
  // Ease the brightness jump (apple-design §14): cross-fade, instant under reduced motion.
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(apply)
  else apply()
}
```
- [ ] **Step 3:** `<Toaster theme="system">` reads the same class? No: sonner's `theme` takes `'light' | 'dark' | 'system'`; pass the current state from a small `useTheme()` hook (a `MutationObserver` on `documentElement.class`).
- [ ] **Step 4: Dark details from CLAUDE.md:** video players and video tiles stay near-black (`bg-video`); the undo toast background `#3a3a3c` (sonner `toastOptions.classNames.toast` in dark); scrims stay translucent black; play buttons stay white; category badges keep their fill colours (`readableOn` already picks the text).
- [ ] **Step 5: Verify** in the built-in browser with `resize_window colorScheme: dark` and with the toggle: Home, Calendar week/month, clip detail (both roles), add clip, categories, users, login, 404, every dialog and the day drawer. Compare with the "Dark — …" frames (find them by name; read with `get_node_info` when a colour is unclear). Commit `feat: dark mode with header toggle`.

### Task 14: Close every gap from §2 and the Task 2 table

**Files:** `Home.tsx`, `ClipCard.tsx`, `ClipForm.tsx`, `ClipDetail.tsx`, `Review.tsx`, others as the table says.

- [ ] **Step 1: Home today cards** reuse `ClipCard` with a `variant="today"` prop (adds "คลิป i จาก n", script 2 lines, image count, "หมายเหตุ"), instead of the copy in `Home.tsx:427-436`. Status as in the frame (dot + label vs filled chip: check `63:160` at 2x; CLAUDE.md says chips are tinted fills since 2026-11-05, so the frame may be stale; follow the newer one and note it).
- [ ] **Step 2: Owner "งานของฉัน" card** subtitle: `ครีเอเตอร์ส่งงานแล้ว {clip.round} รอบ` for `attention === 'review'`.
- [ ] **Step 3: Thai date field** (`ClipForm`): keep the native input for the picker, show the Thai label.
```tsx
function ThaiDateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="relative">
      <button type="button" onClick={() => ref.current?.showPicker?.()} className="flex h-9 w-full items-center justify-between rounded-md border border-line bg-white px-3 text-sm max-md:h-11">
        {fullDate(fromIso(value))}<ChevronDown size={16} className="text-sub" />
      </button>
      <input ref={ref} id="date" type="date" value={value} aria-label="วัน" tabIndex={-1}
        onChange={(e) => e.target.value && onChange(e.target.value)} className="pointer-events-none absolute inset-0 opacity-0" />
    </div>
  )
}
```
The visible button carries the accessible name ("วัน" via `<Label htmlFor>` moved to the button `id`); the hidden input is `tabIndex={-1}`.
- [ ] **Step 4: Category select** chevron: `appearance-none` plus a `ChevronDown` positioned right, same height as the date field.
- [ ] **Step 5: Note box** heading icon (`FileText`) on creator detail; body `text-base leading-[26px]`.
- [ ] **Step 5b: Typography to Figma** (§3 table): creator title `text-[32px] leading-[1.3] font-bold`; script `text-xl leading-[34px]`; header title, nav items, buttons, meta date and hints `font-light` (Geist 300). Do it once: `font-light` on `<header>` title, `Sidebar` nav, `buttonVariants` base, and the hint/meta classes; check Thai still renders at 300 (Noto Sans Thai Variable covers 100-900, so it does).
- [ ] **Step 5c: Sidebar** (D5): the collapse icon goes at the sidebar's top-right next to "Channel's Tool" (20 Light), not in the header; search box `bg-grid border-[#767676]`; avatar `size-[35px] bg-[#2c2c2c]`.
- [ ] **Step 6:** Work through every remaining row of the Task 2 table. Each fix is a one-line diff in JSX classes or copy; keep labels exactly as the frame.
- [ ] **Step 7: Commit per screen** `fix(figma): <screen> matches <frame ids>`.

---

### Task 15: Verification, Buddy handoff, pull request

- [ ] **Step 1:** `cd web && npm run lint && npm test && npm run build`. All pass.
- [ ] **Step 2: Figma pairs.** Re-shoot `after/<nodeId>.png` for every frame in §3 at its width; update the README table with pass / exception (reason). No unexplained gaps.
- [ ] **Step 3: Upload judge.** Run it if a dev login is available; otherwise copy this list verbatim into the handoff as Buddy's acceptance checklist:
  1. Creator, 5 MB JPG on a clip as reference (owner) and as submission (creator): progress shows, row lands, thumbnail renders, lightbox opens.
  2. 300 MB MP4 as submission; at ~40 % set DevTools offline: row says paused, toast shows; back online: resumes from the parts R2 has (watch Network: no part re-sent twice), completes, clip status becomes ส่งแล้ว on the owner's Home.
  3. Navigate to Calendar mid-upload and back: upload kept going.
  4. Close tab mid-upload: browser asks to leave.
  5. 2.1 GB file and a `.zip`: red rows, no request to `media-upload` in Network.
  6. ProRes `.mov`: owner sees "ดาวน์โหลด", file saves with its Thai name.
  7. Withdraw within 10 minutes (creator), then the button disappears after the window.
- [ ] **Step 4: Response judge.** Performance panel, 4x CPU throttle: approve, move clip down, save. Pressed state on pointerdown frame; INP < 200 ms; screenshots of the three traces in `docs/qa/2026-11-12/perf/`.
- [ ] **Step 5: Reduced motion judge.** `resize_window` + emulate `prefers-reduced-motion: reduce` (DevTools Rendering): repeat approve, week next, open lightbox, open day sheet; nothing slides or scales, state still visible.
- [ ] **Step 6: Keyboard and screen reader.** Tab through clip detail (creator): upload zone reachable, Enter opens picker; lightbox traps focus, Esc returns focus to the tile; `aria-live` announces upload done.
- [ ] **Step 7:** Run `impeccable detect --json` over changed files (path in the impeccable skill); fix or justify each finding.
- [ ] **Step 8:** Update `CLAUDE.md` "State of the repo" (upload UI wired, Uppy installed, motion tokens, no `UploadDisabled`) and remove "Uppy is not installed yet".
- [ ] **Step 9: Write `docs/buddy-handoff-2026-11-12.md`** (frontend done, backend to tie in). Sections:
  1. **What the frontend now calls** (no new API; all in `web/src/api/index.ts`): `startUpload`, `signUploadParts` (one part per call), `listUploadParts`, `completeUpload`, `abortUpload`, `viewUrls` (batched per opened clip, `download: true` for downloads), `moveClip` (optimistic), `reviewClip`/`restoreReview` (optimistic).
  2. **Needs backend, not done by us:** dev bucket CORS `exposeHeaders: ["ETag"]`; the upload acceptance checklist (Step 3) if we could not run it; drag-to-reorder needs a bulk reorder RPC (frames `74:13259`); notifications need a table (frames "แจ้งเตือน"); any copy or limit that must match `_shared/media.ts` (the unit test in Task 6 guards part size and threshold).
  3. **Assumptions to confirm:** server part size 50 MB for ≥100 MB files; `media.round` and `clip.round` meaning as used in "ครีเอเตอร์ส่งงานแล้ว N รอบ"; video duration on tiles is read client-side from video metadata (no column).
  4. **How to check it:** `npm run dev` with `web/.env.local` pointed at dev, the Figma pairs in `docs/qa/2026-11-12/`.
- [ ] **Step 10: Commit** `docs: QA evidence, Buddy handoff, repo state`; push the branch and open a PR to `main` (title "Frontend finish: media UI, dark mode, motion, feedback, Figma fidelity"; body: summary, the scope rule "frontend only", link to the handoff doc, test results). Confirm with the user before pushing.

---

## Self-review

- **Coverage:** upload UI (6-8, 10), playback/lightbox/download (9), Figma gaps (2, 14 + §2 table), dark mode (2b, 13b), hover and press feedback (3), pending/result feedback (4, 5, 11), animation (11-13, 13b cross-fade), broken things (3, 4, 5, §2 "Broken now"), PR + handoff (15). Only `web/` and `docs/` change. Notifications and drag reorder are out because they need backend (§0, handoff).
- **Placeholders:** Task 7 Step 1 leaves one implementation choice (bad files in Uppy vs local state) with the required behaviour stated; Task 14 Step 6 depends on the Task 2 table, which cannot be written before the remaining frames are exported (Figma MCP limit).
- **Names:** `MULTIPART_AT`, `PART_BYTES`, `createUploader`, `UploadProvider`, `useUploads`, `UploadZone`, `useViewUrls`, `withTransition`, `useOptimistic`, `swapInDay`, `progressLabel`, `ThaiDateField`, `Skeleton`, `useDelayed` are each defined once and used with the same names.
- **Risks:** Uppy option names can differ by major version (Task 6 Step 2 checks). R2 dev CORS must expose `ETag` (Task 6 Step 5). View Transitions are not in every browser; `withTransition` falls back to an instant update. `showPicker()` needs a user gesture (it gets one) and is missing on old Safari (falls back to nothing: keep the native input visible there if needed).
