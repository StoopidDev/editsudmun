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
- `npm run build` without `VITE_SUPABASE_*` builds an empty app (`src/api/supabase.ts` throws at load and the bundler drops everything). Build with real or dummy values; consider failing at runtime instead.
- `npm audit` flags `deepmerge` and `minimatch` through the `shadcn` CLI package (not shipped to the browser).
- Not checked in a browser with data: every screen, dark mode, animations, drawer swipe, uploads. The app boots with dummy env, redirects to `/login`, applies the dark theme from the system setting and logs no console errors.

## 5. How to check it

```bash
cd web && npm ci
```
Put the dev URL and publishable key in `web/.env.local`, then `npm run dev`, sign in as owner and as creator, and walk the checklist above in light and dark at 375, 768 and 1440 px. Compare with the Figma frames listed in §3 of the plan.
