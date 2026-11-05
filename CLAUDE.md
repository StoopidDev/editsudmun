# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## State of the repo

Vite + React + TS app, implemented from `docs/superpowers/plans/2026-11-04-frontend-fake-layer.md`. The frontend runs on a browser-only fake backend in `src/api/fake/`, seeded into localStorage (key `fake-db-v2`); Buddy's Supabase backend is not connected yet. File upload is disabled until R2 exists, so all media is seeded rows with no real file. Notifications, dark mode and animation are not built.

The app lives in `web/` (monorepo layout from the spec; `supabase/` goes beside it). Run commands from `web/`: `npm run dev`, `npm test` (Vitest, logic and fake API only), `npm run lint`, `npm run build`.

Fake logins: `owner@example.com` / `owner1234`, `creator@example.com` / `creator1234`. The session is in sessionStorage; run `localStorage.clear(); sessionStorage.clear()` in the console to reseed (seed dates are relative to the first load).

All data access goes through `src/api/index.ts`; screens must not import `src/api/fake/`. To connect Supabase, replace `src/api/index.ts` and delete `src/api/fake/`. Assumed columns not in Buddy's spec yet: `categories.color`, `clips.status`, `clips.revision_note`, `clips.deleted_at`, `clips.brief_updated_at`, `clip_media.file_name`; also a way to read user emails, and an owner password reset. See the "Handoff to Buddy" list at the end of the plan.

Code and Figma match as of 2026-11-05 (UX audit fixes, plan `docs/superpowers/plans/2026-11-05-ux-audit-fixes.md`): brand `#0066cc`, danger `#d70015`, success `#1a7f3c`; category text colour is computed with `readableOn` (`src/lib/color.ts`); status labels are รอทำ, ส่งแล้ว, อนุมัติแล้ว, รอแก้ไข; the week view is 7 columns only from `xl` (1280 px), below that it is the one-day view; the clip form autosaves a draft on every change (`src/lib/draft.ts`); Home shows `งานของฉัน` and an expiring-files warning. Backend asks from this round are in `docs/buddy-handoff-2026-11-05.md`.

Later plans: connect Supabase; upload and playback (Uppy, presigned R2, video player, download-all, lightbox, upload error states); polish (dark mode, animation, drag reorder); notifications if the client confirms.

## What this is

A brief-management web app for a content-channel owner and one creator (voice-over + editing). It replaces LINE ordering, where messages get lost and scripts are hard to trace. Scale target: 1-2 clips/day now, 5/day soon, 50-70/day later. Client deadline: 7-10 days.

Owner enters weekly clip briefs; creator opens the app to see what to make each day.

The user's own Excalidraw lists four pain points and a solution for each: (1) messages flow away -> sort what is sent into categories, (2) scripts hard to find -> pin notes and Ctrl+F search, (3) hard to check work because LINE files expire -> files must not expire, (4) hard to schedule -> deadline check-in / calendar.

## Stack

Buddy's spec (`system-design.md` Draft v2, 2026-11-03, copied to `docs/system-design.md`) is the source of truth for the backend. Summary:

Frontend: React + Vite + TS + Tailwind + shadcn/ui, TanStack Query, React Router, date-fns, Uppy (uploads). Backend: Supabase Free (Postgres + RLS + Auth + Edge Functions `create-creator`, `media-upload`, `media-view`). Files go to a private Cloudflare R2 bucket, not Supabase Storage. The browser uploads and views directly through presigned URLs; files never pass through our server. Installed so far: React, Vite, TS, Tailwind v4, shadcn/ui (base-nova, built on @base-ui/react: no `asChild`, use `render` and `nativeButton={false}`), TanStack Query, React Router, date-fns, sonner, lucide-react, Vitest. Uppy is not installed yet.

## Domain model

Week -> Day (Mon-Sun) -> Clip. There is no weeks table; a week is `clips where date between Monday and Sunday order by date, position`.

```
profiles(id, role owner|creator, display_name)
categories(id, name, position)
clips(id, date, position, category_id, title, script, note, created_by, updated_at)
clip_media(id, clip_id, kind image|video, purpose reference|submission,
           r2_key, mime, size_bytes, status pending|ready, uploaded_by, created_at, expires_at)
```

- A clip has a category (default "รีวิว" and "คอนเทนต์"; the owner can add more), a title, a script, one `note` text field (render each line as a bullet in the notes box), and media.
- Media: `reference` = files the owner attaches to the brief (images and video). `submission` = finished edits the creator sends back (H.264 ≤1080p, max 2 GB per file by default).
- Files are deleted automatically after 30 days by default (lifecycle per purpose). This contradicts pain point 3 "files must not expire": confirm with the client. Show the remaining days on each file.
- `storage_usage` view gives the owner total storage used.
- No edit history: `clips` only has `updated_at`.
- Upload: files <100 MB use a single presigned PUT; files ≥100 MB use multipart (resumable). Too large = 413, disallowed mime = rejected. Browser-unplayable video (e.g. ProRes) gets a download button instead of a player.
- `media-view` takes a batch of ids and returns 1-hour GET URLs. Call it only when a clip is opened or a video is played, never for every card on the week page.

## Roles and permissions

"Client" (user's word) and "owner" (friend's brief) are the same person. Use **owner** everywhere, in the UI and the database. The creator is the editor (คนตัด in the user's sketch).

- `owner`: full CRUD on categories, clips and media; uploads and deletes reference files; views and deletes submissions; creates creators.
- `creator`: read-only on briefs, categories and reference files. Can upload their own submissions only, and can never delete or edit them (they are evidence). A re-submission is a new file, so a clip can have several submission rounds.

Permissions are enforced by Supabase RLS and Storage policies, not by the UI. The client's concern is a creator editing briefs after the fact to match the work done. Hiding buttons in the frontend is only UX; never rely on it as the access control, and never use the service role key in the frontend.

Auth is email/password with public sign-up disabled. Creator accounts are created by a backend Edge Function (needs service role), called from the owner's user-management page.

## Open questions

Answered by Buddy's spec: video is in v1; the creator uploads submissions back; categories are clip types.

Still open:

1. Category color: `categories` has no `color` column, but the designs color รีวิว/คอนเทนต์ and the category form has a color picker. The designs keep the picker; ask Buddy to add `color`.
2. Recently Edited: the designs describe each change ("แก้ไขสคริปต์", "ย้ายไปวันพุธ"), but there is no change history, only `updated_at`. Either show only the time or ask for an audit log.
3. Work status (รอทำ / ส่งแล้ว / ผ่าน / แก้) and notifications (LINE / email): open in the spec; not designed.
4. File retention: 30 days, shorter, or delete after approval (spec §12).

A larger ChatGPT-suggested scope (script version history, review/approval flow, publishing, calendar-linked deadlines) was considered and judged out of v1 scope for the 7-10 day target.

## Pages (frontend)

Design decision by the user (2026-10-29, not yet confirmed by the friend): the brief's "week page as home" is split into a widget Home and a full Calendar.

1. Login
2. **Home** (widgets): Today (today's clip cards), This Week (7-day strip with colored bars per clip, today highlighted), Recently Edited (changes to briefs, so the creator can see edits). Owner also gets add-clip buttons.
3. **Calendar**: week view (7 day columns, clip cards, prev/next week, today highlighted) and month view (per-day clip count plus a รีวิว chip and a คอนเทนต์ chip; titles are not shown because a day can hold 50+ clips). Toggle สัปดาห์ / เดือน. Clicking a day should open the week view.
4. **Clip detail**: creator = brief read-only (large readable script, notes highlighted, reference images/videos open enlarged on click, previous/next clip in the day) plus a "ส่งงาน" section to upload submissions with progress, and a list of their submitted rounds (no delete); owner = every field editable, copy to another day, delete, save, plus the submissions list with video player and delete.
5. Clip form (owner): day, category, title, script, note, reference upload (images + video, progress, size/type errors), copy clip to another day, reorder clips within a day
6. Category management (owner)
7. User management (owner), calls the backend Edge Function
8. Fully responsive (phone, tablet, laptop, large desktop). Week view on small screens: one day at a time or a vertical stack.

Sidebar: search (clip search; the user's pain point 2), หน้าแรก, ปฏิทิน for everyone; ประเภทคลิป and ผู้ใช้งาน for owner only.

UI language is Thai (days, labels, copy); the client and users are Thai. Weeks start Monday.

## Backend contract

Buddy supplies generated TypeScript types from the DB. Use those instead of hand-writing row types; do not edit the generated file by hand.

## Design

Figma file "Content-Making-Tools": https://www.figma.com/design/kpWQQKpAY5HuysQ8RH2XH7/Content-Making-Tools (file key `kpWQQKpAY5HuysQ8RH2XH7`). The Figma MCP can read and write it. The account is on the Starter plan with View seats; writes work, but the MCP has a tool-call limit that was hit on 2026-10-29 and blocked all calls (reads included) until it resets.

Pages: "Desktop" (`0:1`, 1440x900 frames), "Tablet" (`7:2`), "Mobile" (`7:3`). Always put new frames on the page that matches their device. Node ids:
- Original design (left untouched, near x=6487, y=-312): loose sidebar/header/widgets from before the brief; its categories (Chat, Work) and Calendar/Recently upload widgets do not match the brief.
- Home widgets: owner `63:160`, creator `63:387`
- Calendar week: owner `54:54`, creator `60:317`
- Calendar month: owner `65:96`, creator `65:619`
- Clip detail: creator `60:61`, owner (edit) `60:174`
- Calendar week states (owner, y=7900): dense day (14 clips, 4 compact cards + "ดูเพิ่มอีก 10 คลิป") `102:1413`, empty week `102:1676`, loading skeleton `102:1935`
- Media flows from Buddy's spec (y=9100): creator clip detail with submit section, uploading `102:2240`, file over 2 GB error `102:2384`; owner clip detail with submissions review (video player, rounds, download for ProRes, delete) `103:2528`; add-clip reference upload with video tile, upload progress and wrong-type error `103:2720`
- Owner Home with storage usage widget (y=10100): `103:2885`
- Users (owner): list `90:1896`, create `90:1990`, success `90:2097`, delete confirm `90:2215`
- Login: desktop default `92:1279`, loading `92:1301`, error `92:1324`; mobile `92:1347`, `92:1369`, `92:1392`
- Add-clip (owner): empty `74:1365`, filled `74:1459`, validation error `74:1575`, copy-to-day modal `74:1692`
- Day drawer (420px, opens from a day): owner menu `74:12986`, owner drag-reorder `74:13259`, creator read-only list `74:13528`
- Categories (owner): Thai-named `87:1665` list, `87:1749` add, `87:1859` delete confirm, `87:1959` empty. (The English-named duplicate set was deleted on 2026-11-05.)
- Tablet 768x1024, creator, 64px icon-only sidebar (on page "Tablet", `7:2`): Home `102:918`, Calendar week (7 narrow columns) `102:1100`, Clip detail (single column, notes above script, images in one row) `102:1304`
- Tablet, second batch (page "Tablet", y=1200 and y=2500): Home owner with storage `105:3986`, Calendar week owner `105:4209`, Clip detail with submit section (creator, tall scroll frame) `105:4458`, Calendar month creator `105:4586`, Login default `105:4928`, loading `105:4948`, error `105:4970`
- Mobile, second batch (page "Mobile", y=900; owner flow): Calendar week owner with FAB `105:3208`, hamburger menu panel `105:3307`, categories list `105:3426`, users list `105:3538`, Home owner with storage widget (tall) `105:3741`, clip detail with submit section (creator, tall) `105:3657`, day bottom sheet `105:3860`
- Mobile, third batch (page "Mobile", y=1800): modals add category `105:4993`, delete category `105:5060`, create user `105:5116`, delete user `105:5188`; owner clip edit with submissions review (video player, rounds) `105:5252`; creator upload error (file over 2 GB) `105:5349`
- Tablet owner pages (page "Tablet"): categories list `105:5630`, users list `105:5946`, add-clip `105:6241`, calendar month `105:6580`, day drawer over week `105:7120`, clip detail with submissions review `105:7442`; modals: create user `105:7828`, create success `105:7939`, delete user `105:8043`, add category `105:8144`, delete category `105:8275`
- Tablet calendar states (page "Tablet", owner week): dense day `105:8462`, empty week `105:8718`, loading skeleton `105:8969`
- Mobile calendar states (page "Mobile", y=2700, owner): dense day `108:9594`, empty day `108:9709`, loading `108:9814`
- Dark mode (recolored clones of the light frames; dark tokens: background `#1b1b1d`, surface `#262628`, grid/border `#3a3a3c`/`#8e8e93`, text `#f2f2f2`, secondary text `#a0a0a5`, orange status label `#ffb04d`, today tint `#12304d`, notes box `#3a3112`; brand, รีวิว, คอนเทนต์ and danger colors unchanged).
- Dark frames: every light frame has a copy named "Dark — …" (130 in total, regenerated 2026-11-05 with a script: Desktop 53, Tablet 36, Mobile 41; rows start at y=40000, Desktop 6 per row, Tablet and Mobile 8 per row). Find them by the `Dark —` name, not by id; the ids change whenever they are regenerated. Dark tokens as before, plus status chip tints (`#12301c` green, `#3a2810` orange, `#3a3a3c` grey) and `#4da3ff` for blue text. The recolor skips neutrals inside coloured fills; frames with a scrim (modals) may leave the page behind the scrim partly light. If a light frame changes, delete its dark copy and clone it again.
- **Work status and notifications (designed; the spec leaves both as open questions, so confirm with the client before the backend builds them).** Status values: รอทำ (grey), ส่งแล้ว (blue), ผ่าน (green), แก้ไข (orange); the owner approves or requests changes with a reason that the creator sees as an orange banner; notifications are a bell with a dropdown (desktop, tablet) or a list page (mobile).  Desktop (page "Desktop", y=16100 to 17100): week with status chips `108:20704`, owner approve/request-changes `108:20979`, creator revision banner `108:21184`, owner Home notifications `108:21332`, creator Home notifications `108:21557`. Mobile (y=10000): notifications list `108:21772`, creator revision banner `108:21894`, owner approve/request-changes `108:21981`. Tablet (y=17000): Home notifications creator `108:23404`, owner `108:23609`. Dark copies exist for all of them (Desktop y=18100, Mobile y=11800, Tablet y=17900). A backend this needs: a `status` column on `clips` or a per-round status on `clip_media`, a `revision_note`, and a `notifications` table; none exists in the spec yet.
- Dark mode audit: all dark frames were scanned for leftover light fills, dark text and light scrims (only intended white play buttons remain). Special cases handled when regenerating: video players and video tiles stay near-black, the undo toast becomes `#3a3a3c`, translucent black scrims stay black.
- UX fixes applied 2026-11-04 (see `UX-FIX-PLAN.md`; retention stays at 30 days because Buddy rejected "archive": it only hides files that still cost storage). Light frames, Desktop page y=19300 to 20300: delete-clip undo toast `112:2079` (owner calendar; Tablet `112:2324`, Mobile `112:2569`); search results `112:2686`, no results `112:3260`, tablet `112:2973` and `112:3357`, mobile `112:3454` and `112:3588`; creator upload network lost `112:3691`, upload failed `112:3834`, withdraw wrong file within 10 minutes `112:3977`, mobile failed `112:4122`, mobile withdraw `112:4207`, tablet failed `112:4294`, tablet withdraw `112:4430`; owner retention warning ("มี 2 ไฟล์จะถูกลบใน 5 วัน" plus "ดาวน์โหลดทั้งหมด") `112:4568`, mobile `112:4768`; add-clip restore-draft banner `112:4877`; mobile day sheet with the ⋯ clip menu open (แก้ไข, คัดลอก, ย้ายขึ้น, ย้ายลง, ลบ) `112:20909`. In-place fixes on existing frames: contrast tokens and 12 px minimum text everywhere, Thai copy (ยินดีต้อนรับกลับมา, เจ้าของ, ครีเอเตอร์, "Channel's Tool" spacing; the real product name still comes from the client), Recently Edited shows only "อัปเดตล่าสุด" plus time, days-left on reference files and "ดาวน์โหลดทั้งหมด" on submissions, forgot-password hint on every login frame, temporary-password "จะไม่แสดงอีก" hint, 44 px touch buttons on the mobile categories and users cards, "ย้ายขึ้น / ย้ายลง" in the clip menu (desktop and tablet), category filter chips in the day drawers and the mobile day sheet, "บันทึกร่างอัตโนมัติแล้ว" in the add-clip top bar. Backend implications for Buddy: soft delete (`clips.deleted_at`), withdraw rule on `clip_media` (creator, own submission, within 10 minutes), full-text search over title, script and note.
- Mobile 375x812 (on page "Mobile", `7:3`, including the mobile login frames `92:1347`, `92:1369`, `92:1392`): Home creator `99:918`, Calendar week creator `99:1025`, Calendar month creator `99:1120`, Clip detail creator `99:1344`, Clip edit owner `99:1403`

- UX audit fixes, Figma round (2026-11-05; plan `docs/superpowers/plans/2026-11-05-ux-audit-fixes.md`, Part B). Applied in place: brand, danger, approve and badge colours on every light frame; status chips use tinted fills with the new labels; mobile clip detail order (title, notes, script, files, submit) on `99:1344`, `105:3657`, `105:5349`, `108:21894`, `112:4122`, `112:4207`; "กลับ" back label and pager text "ของวันนั้น" on clip detail and add-clip frames; owner clip edit frames now have the pager in the top bar and `ลบคลิป` at the bottom of the right column (desktop `60:174`, `103:2528`, `112:4568`, `108:20979`; tablet `105:7442`; mobile `99:1403`, `105:5252`, `108:21981`, `112:4768`, delete moved out of the bottom bar); add-clip frames show `บันทึกและเพิ่มต่อ` instead of `ยกเลิก`; Home frames got `งานของฉัน`, the expiring-files warning (owner) and status chips on today's cards (desktop `63:160`, `63:387`, `103:2885`; tablet `102:918`, `105:3986`; mobile `99:918`, `105:3741`); tablet calendar frames now use the one-day layout (`102:1100`, `105:4209`, `105:7120`, states `105:8462`, `105:8718`, `105:8969`); `ดูทั้งวัน` link on every week frame; mobile calendar toolbars are 44 px; mobile month `99:1120` has a category legend; category lists show a disabled delete and a hint (`87:1665`, `105:5630`, `105:3426`); the English-named categories set and a stale duplicate of tablet loading `105:9283` were deleted; temp password frames `90:2097`, `105:7939` cannot be closed before copying.
- New frames, 2026-11-05. Desktop (y=21500): review with the reason box open `130:2858`, approved with undo toast `130:3071`, change password `130:4442`, reset password confirm `130:4550`, sidebar with `เปลี่ยนรหัสผ่าน` `130:4761`, 404 `130:5428`. Tablet (y=20900): change password `130:4808`, reset confirm `130:4938`, search before typing `130:5335`, 404 `130:5518`. Mobile (y=17000 and below): reason box open `130:3335`, approved with undo `130:3454`, change password `130:5059`, reset confirm `130:5131`, menu with `เปลี่ยนรหัสผ่าน` `130:5195`, search before typing `130:5395`, 404 `130:5634`. Tablet search result frames `112:2973`, `112:3357` now show the search input. Ids of frames created by script start with `130:`. Not drawn: a tablet rail frame for the change-password icon, and a tablet version of the review states (there is no tablet owner approve frame).
Not designed yet: nothing. Every page is designed on Desktop, Tablet and Mobile in light and dark. Work status and notifications are fully designed (frames named "สถานะงาน", "อนุมัติ/ขอแก้ไข", "ถูกขอแก้ไข", "แจ้งเตือน"), but the spec still lists them as open questions, so the client and the friend should confirm them before the backend builds them. If the client declines, delete those frames.

Tokens used in the frames (match these when building): font Geist (Light, Regular, Bold; Thai falls back automatically), primary `#0066cc` (dark frames keep `#0088ff` for fills and use `#4da3ff` for text), text `#1e1e1e`, secondary text `#5f5f5f` (min 12 px; changed from `#757575` for contrast), borders `#757575`, surface `#f5f5f5`, grid lines `#d9d9d9`, today tint `#eaf4ff`, notes box `#fff4d6` with `#ffcc00` border, รีวิว `#6155f5`, คอนเทนต์ `#34c759`, danger `#d70015` (dark `#ff383c`), success `#1a7f3c`, รีวิว and คอนเทนต์ badges are filled with the category colour (white text on รีวิว, `#1e1e1e` on คอนเทนต์), corner radius 10.

Mock data in the frames (watch reviews, week 26 Oct - 1 Nov 2026, today = Thu 29 Oct) is invented; replace with real data from Supabase.
