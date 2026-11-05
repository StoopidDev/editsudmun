# Handoff to Buddy: UX audit round (2026-11-05)

Send this to Buddy. It lists what the frontend now relies on that is not in `system-design.md` (Draft v2). Nothing here changes the stack. The earlier list is at the end of `docs/superpowers/plans/2026-11-04-frontend-fake-layer.md` ("Handoff to Buddy"); this one adds to it.

The frontend runs on a browser-only fake API until the backend is connected, so every item below is something the real backend must reproduce.

## Needed (the frontend breaks without these)

**1. New column `clips.brief_updated_at`.**
`updated_at` also changes when the owner approves or requests changes, so "แก้ไขล่าสุด" would tell the creator a brief changed when it did not. A trigger keeps the new column right and needs no frontend logic:

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

The "recently edited" list sorts by `brief_updated_at`. Saving a clip with no changes must not move it.

**2. Owner resets a creator's password (Edge Function).**
Add one beside `create-creator`, for example `reset-creator-password`: check `is_owner()`, call `auth.admin.updateUserById` with a generated password, return it once. The UI shows it once and cannot be closed until the owner copies it.

**3. Any user changes their own password.**
Use `auth.updateUser`. The UI asks for the current password and requires 8 or more characters. Add one line to spec §1. Decide whether the backend re-checks the current password (recommended).

**4. Keep `clips.status` correct without giving the creator UPDATE on clips.**
RLS correctly stops creators editing `clips`, but the status must move when they submit. Suggested triggers (security definer):
- insert into `clip_media` with `purpose = 'submission'` sets `clips.status = 'submitted'` and clears `revision_note`;
- deleting the last submission (withdraw or owner delete) sets `status = 'todo'`;
- only the owner can set `approved` or `revision` (a normal clips update).

The fake API does the same: see `dropMedia` and `reviewClip` in `web/src/api/index.ts`.

## Decide

**5. Owner account recovery.** The owner has nobody to ask for a reset. Options: `resetPasswordForEmail` (needs SMTP on Supabase), or a manual reset by you in the dashboard. The login hint ("ลืมรหัสผ่าน? ติดต่อเจ้าของช่อง") stays wrong for the owner until this is picked.

**6. Status and work review are still open in spec §12.** `clips.status` and `clips.revision_note` are assumed. The UI shows รอทำ, ส่งแล้ว, อนุมัติแล้ว, รอแก้ไข. If the client declines, the "งานของฉัน" block and the review buttons are removed.

**7. Copied clips and file expiry.** A copy shares the original's reference files and keeps the original `expires_at`, so a clip copied to a far-future day can lose its files before its date. The UI warns with "ลบก่อนถึงวันคลิป". The rule itself (reset `expires_at` on copy, or copy the file) is your call.

## Queries the frontend uses (no schema change)

- **Attention list.** Owner: `status = 'submitted'`. Creator: `status = 'revision'`, or `status = 'todo' and date < today`. Soft-deleted clips are excluded. Order: revision, review, then overdue, then by date and position.
- **Expiring files** (owner only): `clip_media` with `expires_at <= now() + interval '7 days'`, joined to live clips, soonest first.
- **Review undo.** The owner puts the earlier `status` and `revision_note` back with a normal update. No policy change.

## Already agreed earlier, still pending

`categories.color`, `clips.deleted_at`, `clip_media.file_name`, owner access to user emails, the 10-minute withdraw rule, and full-text search over title, script and note.
