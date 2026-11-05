-- Helper functions, triggers and RPCs. Every function pins search_path to ''.

-- Role check used by every policy. security definer avoids RLS recursion on profiles.
create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'owner')
$$;

-- Days a file is kept, per purpose. MUST match the R2 lifecycle rule on each prefix
-- (reference/, submission/). Change both together.
create function public.retention_days(p_purpose text) returns int
language sql immutable set search_path = '' as $$
  select case p_purpose when 'reference' then 30 when 'submission' then 30 end
$$;

-- R2 key segment for a file name: ASCII only, the original name stays in file_name.
create function public.safe_file_name(p_name text) returns text
language sql immutable set search_path = '' as $$
  select left(nullif(regexp_replace(p_name, '[^A-Za-z0-9._-]+', '_', 'g'), ''), 100)
$$;

-- Profiles ---------------------------------------------------------------------------------
-- Role comes from app_metadata, which only the service role can set.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, display_name, email)
  values (
    new.id,
    coalesce(new.raw_app_meta_data ->> 'role', 'creator'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    lower(new.email)
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Clips ------------------------------------------------------------------------------------
create function public.next_position(p_date date) returns int
language sql stable set search_path = '' as $$
  select coalesce(max(position) + 1, 0) from public.clips where date = p_date and deleted_at is null
$$;

-- Server-controlled columns on a new clip.
create function public.clips_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.position := public.next_position(new.date);
  new.created_by := auth.uid();
  new.status := 'todo';
  new.revision_note := '';
  new.round := 1;
  new.deleted_at := null;
  new.updated_at := now();
  return new;
end $$;

create trigger clips_before_insert before insert on public.clips
for each row execute function public.clips_before_insert();

-- updated_at tracks brief and review changes (Recently Edited), not reordering or delete.
-- round goes up when the owner asks for changes, so later submissions start a new round.
create function public.clips_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_by := old.created_by;
  new.round := old.round;
  if new.status = 'revision' and old.status <> 'revision' then
    new.round := old.round + 1;
  end if;
  if new.date <> old.date then
    new.position := public.next_position(new.date);
  end if;
  if (new.date, new.category_id, new.title, new.script, new.note, new.status, new.revision_note)
     is distinct from
     (old.date, old.category_id, old.title, old.script, old.note, old.status, old.revision_note) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end $$;

create trigger clips_before_update before update on public.clips
for each row execute function public.clips_before_update();

-- Media ------------------------------------------------------------------------------------
-- A client insert cannot choose the key, status, owner, round or dates. copy_clip sets
-- app.copying to keep the source key and expiry (copies share the R2 object).
create function public.clip_media_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c record;
begin
  if current_setting('app.copying', true) = 'on' then
    return new;
  end if;
  select date, round into c from public.clips where id = new.clip_id;
  if not found then
    raise exception 'ไม่พบคลิป';
  end if;
  new.id := gen_random_uuid();
  new.status := 'pending';
  new.ready_at := null;
  new.uploaded_by := auth.uid();
  new.uploader_name := coalesce((select display_name from public.profiles where id = auth.uid()), '');
  new.round := c.round;
  new.created_at := now();
  new.expires_at := now() + make_interval(days => public.retention_days(new.purpose));
  new.r2_key := new.purpose || '/' || to_char(c.date, 'YYYY-MM-DD') || '/' || new.clip_id || '/'
    || new.id || '-' || coalesce(public.safe_file_name(new.file_name), 'file');
  return new;
end $$;

create trigger clip_media_before_insert before insert on public.clip_media
for each row execute function public.clip_media_before_insert();

-- Clip status follows submissions: a ready submission marks the clip submitted, removing the
-- last one returns it to todo. Expiry purges set app.purging so approved work stays approved.
create function public.clip_media_sync_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.purpose = 'submission' and new.status = 'ready' and old.status <> 'ready' then
      update public.clips set status = 'submitted', revision_note = '' where id = new.clip_id;
    end if;
    return new;
  end if;
  if current_setting('app.purging', true) = 'on' then
    return old;
  end if;
  if old.purpose = 'submission' and old.status = 'ready' and not exists (
    select 1 from public.clip_media
    where clip_id = old.clip_id and purpose = 'submission' and status = 'ready'
  ) then
    update public.clips set status = 'todo', revision_note = '' where id = old.clip_id;
  end if;
  return old;
end $$;

create trigger clip_media_status_update after update of status on public.clip_media
for each row execute function public.clip_media_sync_status();
create trigger clip_media_status_delete after delete on public.clip_media
for each row execute function public.clip_media_sync_status();

-- RPCs (owner) -----------------------------------------------------------------------------
create function public.require_owner() returns void
language plpgsql stable set search_path = '' as $$
begin
  if not public.is_owner() then
    raise exception 'ไม่มีสิทธิ์ทำรายการนี้' using errcode = '42501';
  end if;
end $$;

create function public.copy_clip(p_id uuid, p_date date) returns public.clips
language plpgsql security definer set search_path = '' as $$
declare
  s public.clips;
  c public.clips;
begin
  perform public.require_owner();
  select * into s from public.clips where id = p_id and deleted_at is null;
  if not found then
    raise exception 'ไม่พบคลิป';
  end if;
  insert into public.clips (date, category_id, title, script, note)
  values (p_date, s.category_id, s.title, s.script, s.note)
  returning * into c;
  perform set_config('app.copying', 'on', true);
  insert into public.clip_media (clip_id, kind, purpose, r2_key, file_name, mime, size_bytes, status,
    round, uploaded_by, uploader_name, created_at, ready_at, expires_at)
  select c.id, kind, purpose, r2_key, file_name, mime, size_bytes, status,
    1, uploaded_by, uploader_name, created_at, ready_at, expires_at
  from public.clip_media where clip_id = p_id and purpose = 'reference' and status = 'ready';
  perform set_config('app.copying', 'off', true);
  return c;
end $$;

-- Swap a clip with its neighbour in the day; renumbers the day first (restored clips can
-- share a position).
create function public.move_clip(p_id uuid, p_dir int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d date;
  ids uuid[];
  i int;
  t int;
begin
  perform public.require_owner();
  if p_dir not in (-1, 1) then
    raise exception 'ทิศทางไม่ถูกต้อง';
  end if;
  select date into d from public.clips where id = p_id and deleted_at is null;
  if not found then
    raise exception 'ไม่พบคลิป';
  end if;
  select array_agg(id order by position, updated_at) into ids
  from public.clips where date = d and deleted_at is null;
  i := array_position(ids, p_id);
  t := i + p_dir;
  if t < 1 or t > array_length(ids, 1) then
    return;
  end if;
  ids[i] := ids[t];
  ids[t] := p_id;
  update public.clips set position = x.ord - 1
  from unnest(ids) with ordinality as x (id, ord)
  where clips.id = x.id;
end $$;

-- Refuses while live clips use the category; soft-deleted clips in it are purged early.
create function public.delete_category(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_owner();
  if exists (select 1 from public.clips where category_id = p_id and deleted_at is null) then
    raise exception 'ลบไม่ได้ ยังมีคลิปในประเภทนี้';
  end if;
  delete from public.clips where category_id = p_id;
  delete from public.categories where id = p_id;
end $$;

-- Search (everyone, through RLS) -----------------------------------------------------------
create function public.search_clips(p_q text) returns setof public.clips
language sql stable security invoker set search_path = '' as $$
  with q as (
    select '%' || replace(replace(replace(trim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select c.* from public.clips c, q
  where length(trim(p_q)) > 0
    and c.deleted_at is null
    and (c.title ilike q.pat or c.script ilike q.pat or c.note ilike q.pat)
  order by c.date desc, c.position
  limit 50
$$;

-- Storage used, counting a shared R2 object once. Creators get 0 rows' worth.
create view public.storage_usage with (security_invoker = true) as
select coalesce(sum(size_bytes), 0)::bigint as total_bytes, count(*)::int as file_count
from (
  select distinct on (r2_key) r2_key, size_bytes
  from public.clip_media
  where (select public.is_owner())
  order by r2_key
) m;

-- Cleanup jobs (pg_cron) -------------------------------------------------------------------
create function public.purge_deleted_clips() returns void
language sql security definer set search_path = '' as $$
  delete from public.clips where deleted_at < now() - interval '7 days'
$$;

create function public.purge_stale_media() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.purging', 'on', true);
  delete from public.clip_media where status = 'pending' and created_at < now() - interval '1 day';
  delete from public.clip_media where expires_at < now();
end $$;

-- Grants: only signed-in users call the RPCs; cleanup and trigger functions are internal.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_owner(), public.copy_clip(uuid, date), public.move_clip(uuid, int),
  public.delete_category(uuid), public.search_clips(text) to authenticated;
revoke execute on function public.purge_deleted_clips(), public.purge_stale_media(),
  public.handle_new_user(), public.clips_before_insert(), public.clips_before_update(),
  public.clip_media_before_insert(), public.clip_media_sync_status() from authenticated;
