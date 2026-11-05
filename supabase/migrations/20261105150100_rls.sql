-- Row level security. Permissions live here, not in the UI (spec §5, plan decisions 2, 6, 8).

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.clips enable row level security;
alter table public.clip_media enable row level security;

-- Signed-out callers get nothing.
revoke all on public.profiles, public.categories, public.clips, public.clip_media, public.storage_usage from anon;
-- Profiles are written only by the auth trigger and the manage-users function (service role).
revoke insert, update, delete on public.profiles from authenticated;

-- profiles: everyone signed in reads (names on cards, owner's user list).
create policy profiles_select on public.profiles for select to authenticated using (true);

-- categories: everyone reads, owner writes.
create policy categories_select on public.categories for select to authenticated using (true);
create policy categories_insert on public.categories for insert to authenticated
  with check ((select public.is_owner()));
create policy categories_update on public.categories for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy categories_delete on public.categories for delete to authenticated
  using ((select public.is_owner()));

-- clips: creator reads live clips only; owner also sees soft-deleted ones (undo).
create policy clips_select on public.clips for select to authenticated
  using ((select public.is_owner()) or deleted_at is null);
create policy clips_insert on public.clips for insert to authenticated
  with check ((select public.is_owner()));
create policy clips_update on public.clips for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy clips_delete on public.clips for delete to authenticated
  using ((select public.is_owner()));

-- clip_media: creator reads media of live clips, inserts own submissions on live clips,
-- never updates (only the media-upload function marks ready), and may withdraw an own
-- submission while pending or within 10 minutes of it becoming ready.
create policy clip_media_select on public.clip_media for select to authenticated
  using (
    (select public.is_owner())
    or exists (select 1 from public.clips c where c.id = clip_id and c.deleted_at is null)
  );
create policy clip_media_insert on public.clip_media for insert to authenticated
  with check (
    (select public.is_owner())
    or (
      purpose = 'submission'
      and uploaded_by = (select auth.uid())
      and exists (select 1 from public.clips c where c.id = clip_id and c.deleted_at is null)
    )
  );
create policy clip_media_update on public.clip_media for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy clip_media_delete on public.clip_media for delete to authenticated
  using (
    (select public.is_owner())
    or (
      purpose = 'submission'
      and uploaded_by = (select auth.uid())
      and (status = 'pending' or ready_at > now() - interval '10 minutes')
    )
  );
