# Buddy handoff, 2026-11-12: frontend finish

Branch `frontend-finish`, plan `docs/superpowers/plans/2026-11-12-frontend-finish.md`. Only `web/` and `docs/` changed; nothing in `supabase/`. No dev login was available while building, so everything that needs the live backend is listed here for you to check before merging.

## 1. What the frontend now calls

No new endpoints, tables or columns. Everything goes through `web/src/api/index.ts`:

| Function | Used by | Notes |
|---|---|---|
| `startUpload` | `lib/uploader.ts` (Uppy 5 headless, `@uppy/core` 5.2.0, `@uppy/aws-s3` 5.1.0) | single PUT under 100 MB, multipart (50 MB parts) from 100 MB; part size and threshold are checked against `supabase/functions/_shared/media.ts` by a unit test |
| `signUploadParts` | same | one call per file for all parts (cached), single-part fallback |
| `listUploadParts` | same | resume: after a network error the upload id is kept, "อัปต่อจากเดิม" and the retry on `online` resume from the parts R2 has |
| `completeUpload` | same | single PUT: called after the PUT; a rejection shows a red row (not success). Multipart: inside `completeMultipartUpload` |
| `abortUpload` | same | only on user cancel ("ยกเลิก", "ยกเลิกไฟล์นี้"), and for a pending row left by a retry of a single upload; never on errors (that is what keeps resume possible) |
| `viewUrls` | `lib/viewer.ts` | one batched call per opened clip, ready ids only, re-signed every 45 min; `download: true` for downloads (single and "ดาวน์โหลดทั้งหมด", batches of 100) |
| `moveClip`, `softDeleteClip`/`restoreClip`, `reviewClip`/`restoreReview` | `api/queries.ts` | optimistic in the UI, rolled back on error; moves are serialised |
| `createClip` | `pages/ClipForm.tsx` | also called automatically when files are dropped on a new clip that has a title (one create even for several drops) |

`listExpiring` now also filters `status = 'ready'`.

## 2. Needs backend work or a check (not done by us)

1. **Dev bucket CORS must expose `ETag`** like prod (`docs/deploy.md:42`). Without it every multipart upload (100 MB and up) fails at `completeMultipartUpload`.
2. **Upload acceptance checklist** (run on dev with an owner and a creator):
   1. 5 MB JPG as reference (owner) and as submission (creator): progress, row lands, thumbnail, lightbox.
   2. 300 MB MP4 as submission; DevTools offline at ~40 %: row turns orange "เน็ตหลุด · กำลังลองใหม่"; back online: resumes (no part sent twice in Network), completes, clip becomes ส่งแล้ว on the owner's Home.
   3. Navigate to Calendar mid-upload and back: upload kept going.
   4. Close the tab mid-upload: the browser asks to leave.
   5. 2.1 GB file and a `.zip`: red refused rows, no request to `media-upload`.
   6. ProRes `.mov`: owner sees "ดาวน์โหลด", file saves with its Thai name.
   7. Creator withdraws within 10 minutes; the button disappears exactly at the end of the window.
   8. Cancel a 300 MB upload mid-way: row and R2 multipart are gone.
3. **Drag-to-reorder** (frames `74:13259`) is not built: it needs a bulk reorder RPC. Up/down in the clip menu works.
4. **Notifications** (frames named "แจ้งเตือน") are not built: they need a table and the client's yes.

5. **Speed, backend side** (plan `docs/superpowers/plans/2026-11-12-frontend-speed.md` §B):
   1. **Thumbnails.** Reference images are shown from the original file (up to 50 MB) in a 103×68 tile. Add a resized ~400 px WebP (Cloudflare Images or a resize step after `media-upload complete`) and return it from `media-view` as e.g. `thumb_url`; the frontend will use it when present.
   2. **Search cap.** `search_clips` has `limit 50` inside the SQL (`supabase/migrations/20261105150000_functions.sql:233`). The frontend shows "50+ คลิป" at 50 and no paging. To page, drop the inner limit; the frontend then adds "ดูเพิ่ม" with `.range()`.
   3. **Month view row cap.** The month view selects `id, date, category_id, status` per clip; PostgREST's default 1000-row cap truncates it at 50-70 clips/day. A grouped RPC (`date, category_id, count`) fixes it.
   4. **Category counts.** `categoryCounts()` downloads one row per clip ever. Add a view or RPC grouped by `category_id` (where `deleted_at is null`).
   5. **Card preview.** Cards still download the whole script for a 2-line preview. A generated `script_preview` (`left(script, 160)`) and `has_note` would let lists skip `script` and `note`.
   6. **Indexes to confirm:** `clips (date, position) where deleted_at is null`, `clips (status) where deleted_at is null`, `clips (brief_updated_at desc)`, `clip_media (clip_id, created_at)`, `clip_media (expires_at) where status = 'ready'`.
   7. **Lighthouse with data:** Home and clip detail, mobile, Slow 4G; target Performance ≥ 90, LCP ≤ 2.5 s. Also count requests on route changes (should be none within 30 s).

## 3. Assumptions to confirm

- Server part size is 50 MB for files of 100 MB or more, and the server never needs multipart below 100 MB (the client only asks for multipart from 100 MB).
- `clip.round` is the number shown as "ครีเอเตอร์ส่งงานแล้ว N รอบ" on the owner's Home.
- Video duration on tiles is read in the browser from video metadata (no column needed).
- `abortUpload` on a row that is already ready returns 409 and deletes nothing (the client relies on this when a retry races a lost `complete` response).

## 4. Known gaps, accepted for this PR

- A lost `complete` response followed by a retry can leave a second ready copy (rare).
- Automatic part retries inside Uppy (5xx, timeout) do not turn the row orange; only offline and manual retries do.
- A failed multipart that is neither retried nor cancelled stays in R2 until the 1-day lifecycle abort.
- Any change in a clip's ready files re-signs all its URLs, so thumbnails reload; the 45-min re-sign restarts a playing video.
- Colour changes from Figma for contrast (WCAG 4.5:1): light warning text `#b35c00` to `#9a4f00`; dark brand fill `#0088ff` to `#0071e3`; dark approved chip text `#34c759` (not read from the dark frame).
- `npm audit --omit=dev` is clean (the `shadcn` CLI is now a dev dependency).
- `npm run build` without `VITE_SUPABASE_*` builds an empty app (`src/api/supabase.ts` throws at load and the bundler drops everything). Build with real or dummy values; consider failing at runtime instead.
- Bundle (JS, gzip): before one 311 kB file for every page; now login 193 kB, Home 239 kB (targets were 150 and 230; react-dom + react-router alone are ~100 kB). Uppy (25 kB) loads on idle or the first dropped file. Next saving: replace `@supabase/supabase-js` with `auth-js` + `postgrest-js` + `functions-js` (about 25 kB on every page; storage and realtime are bundled but unused) — needs a dev login to prove sessions survive (`storageKey`).
- A logged-out visit to an app URL downloads the app shell and page chunks (~55 kB) before redirecting to `/login` (route `lazy` resolves before the guard renders).
- `/assets/*` is cached for a year (`web/public/_headers`); a tab left open across a deploy reloads once when a chunk is missing (`vite:preloadError` in `main.tsx`).
- Data stays fresh 30 s (`staleTime`), `me` until sign-out (an `onAuthStateChange` SIGNED_OUT listener clears it); writes invalidate only clip-related lists (`CLIP_KEYS` in `api/queries.ts`).
- Files queued before the uploader chunk loads: a refusal at flush time is not shown (no Uppy restrictions exist, so none expected). Logout cancels running uploads; their abort calls may race the sign-out.
- Not checked in a browser with data: every screen, dark mode, animations, drawer swipe, uploads. The app boots with dummy env, redirects to `/login`, applies the dark theme from the system setting and logs no console errors.

## 5. How to check it

```bash
cd web && npm ci
```
Put the dev URL and publishable key in `web/.env.local`, then `npm run dev`, sign in as owner and as creator, and walk the checklist above in light and dark at 375, 768 and 1440 px. Compare with the Figma frames listed in §3 of the plan.
