# Frontend Speed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development with the model split from `2026-11-12-frontend-finish.md` ("Execution model"): Haiku 5.5 medium implements each chunk, Sonnet 5.5 high reviews it (read-only, at most 2 fix rounds), the coordinator gates and measures. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the app is fast on a phone on mobile data: the login page and the first app page download only what they need, lists download only the columns they show, nothing refetches without reason, and pages start their data requests at navigation instead of one after another.

**Architecture:** same layers. Route-level code splitting through the data router's `lazy`; the uploader (Uppy) moves into the lazily loaded app shell; one TanStack Query default (`staleTime`) plus narrow invalidation; per-list column selects in `web/src/api/index.ts`; route `loader`s that start the page's queries in parallel with auth.

**Tech Stack:** Vite 8 (Rolldown), React Router 7 data router, TanStack Query 5, supabase-js 2, Cloudflare Workers static assets (`web/public/_headers`).

**Scope rule (user, 2026-11-12):** we change only `web/` and `docs/`. Items that need the database, Edge Functions or R2 go to Buddy in the handoff (§B). Then one PR for the whole branch.

---

## 0. Goal beyond the goal, and the judge

The creator opens the brief on a phone in Thailand, often on 4G. The goal is "the brief is readable within 2 seconds of tapping the link", and it must stay that way at 50-70 clips a day, not only at today's 1-2.

**Outside judges** (numbers, not opinions):
1. **Bundle (measured from `vite build` output, dummy env):** before = one JS file 1,024.7 kB / 311.1 kB gzip for every page including `/login`. Target: the JS a browser must download for `/login` ≤ 150 kB gzip, and for Home ≤ 230 kB gzip; Uppy is not in either. Record the actual numbers in the PR, pass or miss.
2. **Payload (computed, no backend needed):** month view request selects only `id, date, category_id, status`; week, Home and Search requests select no column a component does not read (`tsc` enforces it through narrowed types, see Task 4).
3. **Requests on a repeat visit** within 30 s: zero refetches on route change. Without a backend this can't be counted in the browser, so the judge is the reviewed config (`staleTime` 30 s default, longer for `['me']` and `['categories']`, narrow invalidation) and Buddy counts requests with data (handoff).
4. `npm run lint`, `npm test`, dummy-env build pass; a jsdom test proves a lazy route renders.
5. With a dev login (Buddy, after PR): Lighthouse mobile on Home, Performance ≥ 90, LCP ≤ 2.5 s on "Slow 4G". Listed in the handoff.

---

## A. Frontend (we do now)

### Chunk S1 — bundle (Tasks 1-4)

#### Task 1: Lazy routes

**Files:** Modify `web/src/router.tsx`, `web/src/lib/router.test.tsx`.

- [ ] Replace eager page imports with route `lazy`. Keep `Login` and the guards eager (login is the cold entry). Example:
```tsx
const page = <T,>(load: () => Promise<T>, pick: (m: T) => React.ComponentType) =>
  async () => ({ Component: pick(await load()) })

<Route element={<RequireAuth />}>
  <Route lazy={page(() => import('@/components/AppShell'), (m) => m.AppShell)}>
    <Route index lazy={page(() => import('@/pages/Home'), (m) => m.Home)} />
    <Route path="calendar" lazy={page(() => import('@/pages/Calendar'), (m) => m.Calendar)} />
    <Route path="clips/:id" lazy={page(() => import('@/pages/ClipDetail'), (m) => m.ClipDetail)} />
    <Route path="search" lazy={page(() => import('@/pages/Search'), (m) => m.Search)} />
    <Route element={<RequireOwner />}>
      <Route path="categories" lazy={page(() => import('@/pages/Categories'), (m) => m.Categories)} />
      <Route path="users" lazy={page(() => import('@/pages/Users'), (m) => m.Users)} />
    </Route>
    <Route path="*" lazy={page(() => import('@/pages/NotFound'), (m) => m.NotFound)} />
  </Route>
</Route>
```
  `lazy` keeps view transitions (the router awaits `lazy` before committing). A `HydrateFallback` is not needed (no SSR).
- [ ] Add to `router.test.tsx` a case with a `lazy` route that resolves a component, navigates to it with `viewTransition`, and asserts the content rendered and `startViewTransition` was called.
- [ ] Build; record chunk sizes. Commit `perf: load each page on demand`.

#### Task 2: Uppy only inside the app shell

**Files:** Modify `web/src/main.tsx`, `web/src/components/AppShell.tsx`.

- [ ] Move `<UploadProvider>` from `main.tsx` into `AppShell` (around the `<Outlet />` and anything that uses uploads). Uploads still survive navigation because AppShell stays mounted across app routes. On logout the shell unmounts: before `api.logout()`, if `uppy.getFiles()` has unfinished files, `confirm('ยังอัปโหลดไม่เสร็จ ออกจากระบบเลยไหม')` (native confirm is acceptable here; it is rare and destructive).
- [ ] Check with the build that `@uppy` code is not in the entry chunk (grep the entry file for `upload-success`). Commit `perf: load the uploader with the app shell, not on login`.

#### Task 3: One font import; dev-only CLI

**Files:** Modify `web/src/index.css`, `web/package.json`, `web/package-lock.json`.

- [ ] Delete `@import "@fontsource-variable/geist";` from `index.css` (it is already imported in `main.tsx`); confirm the CSS size drops and Geist still loads.
- [ ] `npm i -D shadcn@<same exact version as now>` and remove it from `dependencies` (moves `deepmerge`/`minimatch` out of the production tree; `npm audit --omit=dev` should be clean of them).
- [ ] Commit `perf: one Geist import; shadcn CLI is a dev dependency`.

#### Task 4: Long cache for hashed assets

**Files:** Modify `web/public/_headers`.

- [ ] Add (after the `/*` block; Cloudflare merges matching rules):
```
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```
  `index.html` and `theme.js` keep the default (revalidated), so deploys still show up at once.
- [ ] Commit `perf: cache hashed assets for a year`.

### Chunk S2 — data (Tasks 5-9)

#### Task 5: Fetch less: per-list columns

**Files:** Modify `web/src/api/index.ts`, `web/src/lib/types.ts`, `web/src/api/queries.ts`, `web/src/pages/Calendar.tsx`, `web/src/pages/Home.tsx`, `web/src/components/ClipCard.tsx`, `web/src/pages/Search.tsx`.

Fields actually read today (grep, 2026-11-12): cards (`ClipCard`, DayDrawer, week, Home today) read `id, date, position, category_id, status, title, script` (2-line preview), `note` (presence), `imageCount`; Home attention adds `revision_note, round`; Home recent reads `id, title, category_id, brief_updated_at`; month reads `id, date, category_id`; Search reads `id, date, category_id, title, script, note`.

- [ ] Types in `lib/types.ts`:
```ts
export type ClipCardRow = Pick<Clip, 'id' | 'date' | 'position' | 'category_id' | 'status' | 'title' | 'script' | 'note' | 'round' | 'revision_note'> & { imageCount: number }
export type ClipDayCount = Pick<Clip, 'id' | 'date' | 'category_id' | 'status'>
export type ClipRecent = Pick<Clip, 'id' | 'title' | 'category_id' | 'brief_updated_at'>
```
- [ ] `api/index.ts`: `const CARD = 'id, date, position, category_id, status, title, script, note, round, revision_note, images:clip_media(count)'`; new `listDayCounts(from, to)` selecting `id, date, category_id, status` for the month view; `listRecent` selects `id, title, category_id, brief_updated_at`. Optimistic patches in `queries.ts` keep working because they only touch these fields; fix any type error the compiler reports instead of widening types.
- [ ] Month view (`Calendar.tsx`) uses `useDayCounts(from, to)` (new hook, key `['dayCounts', from, to]`; include it in the clip invalidation keys of Task 6).
- [ ] `tsc -b` must pass with no `as` casts added to silence a missing field. Commit `perf: lists fetch only the columns they show`.

#### Task 6: Cache sensibly, invalidate narrowly

**Files:** Modify `web/src/main.tsx`, `web/src/api/queries.ts`, callers of `useAct` in `pages/Categories.tsx`, `pages/Users.tsx`.

- [ ] Default: `defaultOptions: { queries: { retry: false, staleTime: 30_000 } }`. `useMe`: `staleTime: Infinity` (cleared on logout via `qc.clear()`, already done). `useCategories`: `staleTime: 5 * 60_000`.
- [ ] `useAct(fn, keys = CLIP_KEYS)` where
```ts
const CLIP_KEYS = [['clips'], ['clip'], ['dayCounts'], ['attention'], ['recent'], ['media'], ['search'], ['expiring'], ['storage']] as const
// invalidate each prefix; ['view'] is never listed, so playback URLs are not re-signed
onSuccess: () => keys.forEach((k) => void qc.invalidateQueries({ queryKey: [...k] })),
```
  Categories mutations pass `[['categories'], ['categoryCounts'], ['clips']]`; Users mutations pass `[['users']]`; ChangePassword passes `[]`. Apply the same keys in `useOptimisticAct`'s `onSettled` and `useDeleteClip`. Remove `notViews` if unused.
- [ ] Commit `perf: 30 s cache by default, writes refresh only what they touch`.

#### Task 7: No waterfalls

**Files:** Modify `web/src/router.tsx`, `web/src/api/index.ts`, `web/src/api/queries.ts`, `web/src/main.tsx` (export the `queryClient` from a module `web/src/lib/queryClient.ts` so loaders can use it).

- [ ] `listAttention(role: Role)` takes the role instead of calling `me()`; `useAttention()` reads it from `useMe()` and is `enabled` only when the role is known.
- [ ] Route loaders start data at navigation, in parallel with auth (`ensureQueryData` dedupes with the components' `useQuery`; do not `await` them so rendering is not blocked):
```ts
// Home
loader: () => { void queryClient.prefetchQuery({ queryKey: ['clips', mon, sun], queryFn: () => api.listClips(mon, sun) }); void queryClient.prefetchQuery({ queryKey: ['recent', 4], queryFn: () => api.listRecent(4) }); void queryClient.prefetchQuery({ queryKey: ['categories'], queryFn: api.listCategories }); return null }
// clips/:id
loader: ({ params }) => { void queryClient.prefetchQuery({ queryKey: ['clip', params.id], queryFn: () => api.getClip(params.id!) }); void queryClient.prefetchQuery({ queryKey: ['media', params.id], queryFn: () => api.listMedia(params.id!) }); return null }
// calendar: same as Home for the visible range from the URL (?date, ?view)
```
  Keys and query functions must be the exact ones the hooks use: export small `xxxQuery(...)` option factories from `queries.ts` (`clipsQuery(from, to)`, `clipQuery(id)`, …) and use them in both hooks and loaders so they cannot drift.
- [ ] Commit `perf: pages start their requests at navigation, in parallel`.

#### Task 8: Bounded lists

**Files:** Modify `web/src/api/index.ts`, `web/src/api/queries.ts`, `web/src/pages/Search.tsx`.

- [ ] `search(q, limit)` → `supabase.rpc('search_clips', { p_q: q }).range(0, limit - 1)`; Search shows 50, then a "ดูเพิ่ม" button raises the limit by 50 (`useInfiniteQuery` not needed: key `['search', q, limit]`, `placeholderData: keepPreviousData`). Result count line says "50+ คลิป" when the page is full.
- [ ] Commit `perf: search returns 50 at a time`.

#### Task 9: Media: load less up front

**Files:** Modify `web/src/components/bits.tsx` (`FileTile`), `web/src/pages/ClipDetail.tsx`, `web/src/pages/ClipForm.tsx`.

- [ ] Video tiles: `preload="none"` until the tile is near the viewport (one `IntersectionObserver` with `rootMargin: '200px'`, then set `preload="metadata"`), so duration still shows once visible.
- [ ] Reference grid shows at most 6 tiles; if more, the 6th tile is "+{n}" and opens the lightbox at index 5 (all files stay reachable).
- [ ] Images: add `width`/`height` attributes from the tile box (avoids layout shift) and `fetchpriority="low"`.
- [ ] Commit `perf: videos load metadata only when visible; at most 6 tiles up front`.

### Gate and judge (coordinator)

- [ ] After each chunk: lint, tests, dummy-env build, `git diff --stat main...HEAD -- supabase` empty.
- [ ] Record bundle numbers (entry + per-route chunks, raw and gzip) before and after in the PR body. Grep the entry and Home chunks for `upload-success` (must be absent).

---

## B. Backend (Buddy, after the PR; added to `docs/buddy-handoff-2026-11-12.md`)

1. **Thumbnails.** Reference images are shown from the original file (up to 50 MB) in a 103×68 tile. Options: Cloudflare Image Resizing / Images in front of R2, or a resize step after `media-upload complete` that writes a ~400 px WebP next to the original and returns its URL from `media-view` (e.g. `thumb_url`). The frontend will use `thumb_url` when present.
2. **Category counts.** `categoryCounts()` downloads one row per clip ever (shortcut comment in `api/index.ts`). Add a view or RPC `category_counts` (`select category_id, count(*) … where deleted_at is null group by 1`).
3. **Card preview.** Cards download the whole script for a 2-line preview. A generated column `script_preview` (`left(script, 160)`) and `has_note boolean` would let lists skip `script`/`note`.
4. **Indexes to confirm** for the new access paths: `clips (date, position) where deleted_at is null`, `clips (status) where deleted_at is null`, `clips (brief_updated_at desc)`, `clip_media (clip_id, created_at)`, `clip_media (expires_at) where status = 'ready'`.
5. **Lighthouse with data** (judge 5): Home and clip detail, mobile, Slow 4G.

---

## Self-review

- Every audit item has a task or a §B line: images (9, B1), code splitting and heavy JS (1, 2), caching (4, 6), over-fetching and bloated responses (5, B3), duplicate requests (6, 7), waterfalls (7), pagination (8, B2), fonts (3), video preload (9), unused deps (3), indexes (B4).
- Names used across tasks: `ClipCardRow`, `ClipDayCount`, `ClipRecent`, `listDayCounts`, `useDayCounts`, `CLIP_KEYS`, `clipsQuery`/`clipQuery`, `queryClient` module — each defined once.
- Risk: lazy routes add one round trip for the first visit to each page (mitigated by the long asset cache and small chunks); loaders must use the same keys as hooks (Task 7 factories).
