# DESIGN.md

Read this before any frontend task (anything in `web/src`). It is the contract for colour, type, affordance, motion and accessibility. If code and this file disagree, fix the code, or change this file in the same commit with the reason.

Sources of truth: tokens live in `web/src/index.css`; the Figma file "Content-Making-Tools" holds the Design System frames (Foundations and Components, Desktop page, y=-6000; Light and Dark are two variable collections because the Starter plan allows one mode each). Backend and product rules are in `CLAUDE.md`.

## 1. Colour

Never write a hex value, a Tailwind palette colour (`red-500`, `gray-*`, `slate-*`) or `text-black/white` for UI chrome. Use the token classes below. Only exceptions: category colours (data from the database, text colour via `readableOn()` in `lib/color.ts`) and `bg-black/..` scrims and `text-white` on video overlays.

| Class | Light | Dark | Use |
|---|---|---|---|
| `bg-bg` | #ffffff | #1b1b1d | page and card surface |
| `bg-surface` | #f5f5f5 | #262628 | sidebar, calendar columns, tracks |
| `bg-chip` | #eeeeee | #3a3a3c | neutral chip |
| `bg-today` | #eaf4ff | #12304d | today highlight |
| `bg-note` | #fff4d6 | #3a3112 | notes box |
| `text-ink` | #1e1e1e | #f2f2f2 | body text |
| `text-sub` | #5f5f5f | #adadb2 | secondary text, 12 px minimum |
| `text-brand-text` | #0066cc | #4da3ff | small brand text and links |
| `text-danger` | #d70015 | #ff383c | error text |
| `text-success-text` | #1a7f3c | #34c759 | success text |
| `text-warn-text` on `bg-warn-bg` | #9a4f00 | #ffb04d | warning |
| `border-line` | #757575 | #8e8e93 | borders of anything interactive or card-like (4.6:1) |
| `border-grid` | #d9d9d9 | #3a3a3c | decorative dividers only (1.4:1, never on a control) |
| `bg-brand text-white` | #0066cc | #0071e3 | primary fill, selected state (white 5.6:1 / 4.7:1) |
| `bg-danger-fill text-white` | #d70015 | #d70015 | solid destructive button (5.4:1 both themes) |
| `bg-success text-white` | #1a7f3c | #1a7f3c | solid approve button (5.1:1) |

Rules: text needs 4.5:1, borders and icons that carry meaning need 3:1. `text-brand` (the fill colour) is for large or non-text uses only; small brand text is `text-brand-text`. Red text is `text-danger`; a red button with white text is `bg-danger-fill`. Selection or status is never colour-only: add an icon, label or position change. Both themes must be checked when a colour changes.

## 2. Typography

Font: **Anuphan Variable** for Thai and Latin (one family, so Thai and Latin share weight and height), then Noto Sans Thai Variable as fallback. Set in `index.css` (`--font-sans`); loaded by `src/main.tsx`. Do not add another font.

Scale (the same in code and in the Figma text styles, which use Anuphan): Display 36 bold (Home welcome, `text-3xl md:text-4xl`), Heading 24 bold (page titles, calendar day numbers, `text-2xl`), Heading 18 bold (section titles, `text-lg`), Title 14 semibold, Body 14 regular, Label 14 medium, Small 12 regular or medium. If you change a size, change it in both places; Figma and code drifted once (Home heading 36 vs 24, day numbers 24 vs 20).

Weights: 400 body, 500 buttons, labels, nav and chips, 600 to 700 titles. **Never `font-light` or lighter** (it was too thin for Thai at small sizes). Minimum text size is 12 px (`text-xs`), body is 14 px (`text-sm`). 

Numbers in data (counts, dates, sizes) use `tabular-nums`. Thai text must not be clipped: keep line-height at least 1.4 on multi-line Thai.

## 3. What looks clickable (affordance)

A user must tell text from a control without hovering (touch has no hover).

1. **Controls** have a visible container: border (`border-line`), fill, or both. Use `Button` from `components/ui/button` (variants default, outline, ghost, danger, secondary). Standalone actions (retry, cancel, play, download, delete, log out, change password) are `Button variant="outline" size="sm"` with an icon, or `ghost` with an icon in menus.
2. **Inline links** use the `link-action` utility: always underlined, brand-text, thicker underline on hover, press scale, focus ring. Forward links get a trailing `ChevronRight`, back links a leading `ArrowLeft`. Secondary jumps may be grey (`link-action text-sub!`, 5.9:1) but stay underlined with an arrow. Never plain coloured text, and never underline-on-hover-only.
3. **Toggles and segmented choices** (สัปดาห์ / เดือน) use `Segmented` (`components/ui/segmented.tsx`): a visible track, a brand thumb that slides to the choice. Unselected options must still read as buttons.
4. **Filter chips** are interactive pills: `rounded-full border border-line`, selected `bg-brand text-white` plus a check icon.
5. **Badges and status chips** (`CategoryBadge`, `StatusChip`) are not interactive: `rounded-md`, filled, no border, no hover, no press. Do not give a non-interactive element a border, a pointer cursor or hover feedback, and do not make a control look like a badge.
6. Cards and cells that navigate (clip card, calendar day header, month cell) lift or tint on hover (section 4) and have a focus ring.
7. Touch targets are at least 44 px on phone widths (`max-md:min-h-11`).

## 4. Motion

Tokens: `--ease-out-quint`, `--ease-in-quint`, `--duration-press` 100 ms, `--duration-state` 200 ms, `--duration-layout` 320 ms (ceiling; drawers are the one exception at 360 ms). Animate `transform` and `opacity`; never width, height, top or left.

| Utility | Effect |
|---|---|
| `press` | scale 0.97 on `:active`, with colour transitions. On every button-like element. |
| `hover-tint` | 6% ink tint on hover. Menu rows, nav items, chips. |
| `card-hover` | lift 2 px, darker border, tinted shadow. Clip cards. |
| `cell-hover` | brand tint and inset brand outline. Calendar grid cells, day headers, week strip. |
| `enter` + `style={{'--i': n}}` | fade and rise 4 px over 200 ms, staggered 30 ms (cap 8). Lists, cards, form cards only; do not stack it on whole pages. Uses fill-mode `backwards` on purpose, so it does not block hover transforms. |
| `link-action` | see section 3. |
| `skeleton` | loading placeholder shaped like the content. |

Hover styles are written as `hover-pointer:` (pointer devices only), never bare `hover:`. **One transition language: pages stack.** The app chrome (sidebar `sidebar`, header `topbar`, tab bar `tabbar`) is named for view transitions so it never animates; only the page area (`main`, name `page`, opaque `bg-bg`) does. On a route change the new page drops in from under the header (translateY -56 px to 0, fade in, 340 ms on `--ease-drawer`) and covers the old page, which sinks 14 px, scales to 0.985 and dims to 55% (300 ms). The `page` group clips (`overflow: clip`), so nothing is drawn over the header. Anything outside the named areas (login, first load) fades through (100 ms out, 160 ms in). It runs through React Router `viewTransition` and `withTransition` in `api/queries.ts`. Never add another entrance style for pages.

Horizontal sliding is reserved for moving *inside* the calendar. The grid carries the class `cal-grid`; CSS names it `cal` only while `<html data-dir>` is set (`next` or `prev`), so a route change never names it. Slide is 24 px for the ‹ › buttons, 72 px (`data-jump` as well) for "กลับไปวันนี้". Whoever sets `data-dir` or `data-jump` must clear them after the transition (see `slide()` in `Calendar.tsx`). `withTransition` sets `data-vt='local'`, which turns the page and root animations off so only the named element moves; use it for any write that changes one element (move, approve, week step).

**Sliding selection.** Single-choice navigation shows one brand thumb that slides to the active item instead of each item switching its own fill: `Segmented` (สัปดาห์/เดือน) and the sidebar nav (`items` at a fixed 40 px height plus 4 px gap; the thumb is `translateY(index * 2.75rem)` on `--ease-drawer`, 260 ms, hidden on pages that are not in the list). Items sit above the thumb (`relative z-10`) and only change text colour.

**Drawers and sheets** (day drawer, mobile menu) slide in over 360 ms on `--ease-drawer` (`cubic-bezier(0.32, 0.72, 0, 1)`), without an opacity fade on left and right sides, and leave in 220 ms on `--ease-in-quint`. A drawer that is mounted already open skips its enter animation, so mount it closed and open it on the next frame (see `DayDrawer`).

**Theme switch is a plain colour fade**: `setTheme` adds `theme-switching` on `<html>` for 250 ms and `index.css` transitions background, text, border, fill and stroke over 200 ms. Do not use a view transition, a circular reveal or any other effect for it.

A view transition freezes the page behind a snapshot, so a control whose own animation matters (the segmented thumb) must not trigger one; use a keyed `enter` on the content instead.

`prefers-reduced-motion` collapses every duration to 1 ms (already in `index.css`); do not override it.

## 5. Layout and components

**Toolbars read left to right as: where am I, how do I move, how do I look.** Calendar toolbar: title (date range) first, then the joined ‹ › pair, then a grey "กลับไปวันนี้" link that appears only when today is outside the shown range and slides the grid toward today; on the right the สัปดาห์/เดือน `Segmented` and the add button. Do not split a control pair around its label, and do not add a control whose job a first-time user cannot name.

**Empty states.** A section with nothing in it never stays blank: use `EmptyState` (`components/EmptyState.tsx`): optional icon, one line saying what is missing (`ยังไม่มีคลิปในวันนี้`), one line saying what to do or why (creator: who has to act). Applies to Home sections, calendar day columns and the one-day view, the day drawer, search, categories, users. Within a grid of cells (week strip, calendar columns) the empty label is centred in the cell.

**Square cells.** Home week-strip cells and calendar clip cards are 1:1 (`aspect-square`, `overflow-hidden`, title clamped to 3 lines), as in the Figma frames. Never let content make a square taller than it is wide.

**Search is a command palette.** Ctrl/Cmd+K and the sidebar search button open `CommandPalette` (top-anchored dialog like the Tailwind docs search): shortcuts when empty, live clip results (debounced 200 ms) with snippet and date, ↑↓ Enter Esc, combobox ARIA. `/search` stays as the full results page ("ดูผลทั้งหมด"). The sidebar field is a button that looks like a field, not an input.

**Confirmations.** Log out and change password ask first (`ConfirmDialog` with `tone="neutral"`, brand button). Deleting keeps the default red `tone`. Do not use `window.confirm`.

**Dates.** Planned `DateLabel` component (not built): `tile` (weekday small above, day number large, month and year small below), `inline` (relative word first: วันนี้, พรุ่งนี้, เมื่อวาน; then `เสาร์ 14 พ.ย.` in grey), `compact` (bold day, grey month). Drop the year when it is the current year. Open question: Buddhist year (พ.ศ.). Until it exists, do not invent new one-line date formats.

**Sidebar profile**: avatar and name/role share one row; "เปลี่ยนรหัสผ่าน" and "ออกจากระบบ" are full-width ghost buttons with icons below it, left edges aligned. A control that sits inside a field (password show/hide) fills the field's height (`inset-y-0`), it is never positioned with a fixed `top`.

Radius 10 px for cards and controls (`rounded-card`), 6 px for small elements, full for chips. Weeks start Monday. The week view is 7 columns only from `xl` (1280 px); below that it is the one-day view. Sidebar is 240 px, a 64 px rail below `lg` or when collapsed; phones get a bottom tab bar. UI language is Thai; copy is direct and sentence case, no exclamation marks, no "Oops".

Shared pieces: `components/ui/*` (shadcn on @base-ui/react: no `asChild`, use `render` and `nativeButton={false}`), `bits.tsx` (CategoryBadge, StatusChip, Skeleton, Delayed, date strip), `ClipCard`, `DayDrawer`, `Lightbox`, `UploadZone`. Reuse before adding.

## 5b. Rules from the design cheat sheets (checked against this app)

Typography: tabular numbers on any changing or columned figure (`tabular-nums`); body line length at most ~65 ch (`max-w-[65ch]` on script and notes); Thai needs taller leading (index.css sets text-xs 1.5, text-sm and text-base 1.6); `text-wrap: balance` on headings and `pretty` on paragraphs are global (widows); never apply negative tracking to Thai. Layout: reserve space for every image and video (aspect ratio plus a background) so loading does not shift the page; `scrollbar-gutter: stable` is on `html`; fixed bottom elements add `env(safe-area-inset-bottom)` (the viewport meta uses `viewport-fit=cover`); touch targets are 44 px on phones. Motion: ease-out for entrances; menus and popovers 150 to 250 ms, start at scale 0.95 and grow from the trigger (`origin-(--transform-origin)`); list rows stagger by 30 ms; press scales to 0.97; exits about 20% shorter than entrances; no bounce or spring on everyday UI; do not tween while held (swipe sets `transition-none`); animations must be interruptible, so prefer CSS transitions to fixed keyframes for state changes; swap icons by crossfading opacity, scale and blur (theme button, password eye) instead of replacing them; a shared element (clip title) travels between list and detail through `shareTitle`; confirm success with a small pulse or the drawn tick, not a toast alone. Colour: tokens are hex today; if you add tints, derive them with `color-mix(in oklab, …)` (perceptually even, like OKLCH) rather than by eye. Data: writes are optimistic (`useOptimisticAct`), never block the UI on the network. Not used here (do not add without a reason): rubber-banding, arcs, bounce, comboboxes, progressive-disclosure wizards.

## 6. Accessibility

Every interactive element has a visible focus style (the `Button` ring, or `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`). Icon-only controls have `aria-label`. Toggles use `aria-pressed`; groups have a label. Inputs keep a visible label or `aria-label`. Errors are inline text with `text-danger`, never `alert()`.

## 7. Before you finish a frontend change

1. Colours come from tokens; contrast checked in light and dark (`lib/color.ts` has `contrast()`).
2. Every new clickable thing passes section 3 without hovering.
3. Hover is `hover-pointer:`; press and focus exist; reduced motion still works.
4. `npm run lint`, `npm test`, and `npm run build` (needs `VITE_SUPABASE_*` vars) pass; look at the page in the browser in light and dark, and at phone width.
5. If you changed a token, a rule or a component here, update this file and the Figma Design System frames.
