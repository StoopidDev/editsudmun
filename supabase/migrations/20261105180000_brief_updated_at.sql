-- From the frontend handoff (docs/buddy-handoff-2026-11-05.md):
-- 1. clips.brief_updated_at moves only when the brief changes (date, category, title, script,
--    note), so "แก้ไขล่าสุด" is not bumped by approve/request-changes. updated_at still tracks
--    brief and review changes.
-- 2. Review undo (restoreReview) can put a clip back into revision. round must count real
--    submission rounds, so it goes up only when files were sent in the current round, and comes
--    back down when a revision request with no files after it is undone.

alter table public.clips add column brief_updated_at timestamptz not null default now();
update public.clips set brief_updated_at = updated_at;
create index clips_brief_updated_idx on public.clips (brief_updated_at desc) where deleted_at is null;

create or replace function public.clips_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.position := public.next_position(new.date);
  new.created_by := auth.uid();
  new.status := 'todo';
  new.revision_note := '';
  new.round := 1;
  new.deleted_at := null;
  new.updated_at := now();
  new.brief_updated_at := now();
  return new;
end $$;

-- security definer: reads clip_media to decide the round, whatever the caller can see.
create or replace function public.clips_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  sent boolean;
begin
  new.created_by := old.created_by;
  new.round := old.round;
  if new.status is distinct from old.status and 'revision' in (new.status, old.status) then
    select exists (
      select 1 from public.clip_media
      where clip_id = old.id and purpose = 'submission' and round = old.round
    ) into sent;
    if new.status = 'revision' and sent then
      new.round := old.round + 1;
    elsif old.status = 'revision' and not sent and old.round > 1 then
      new.round := old.round - 1;
    end if;
  end if;
  if new.date <> old.date then
    new.position := public.next_position(new.date);
  end if;
  if (new.date, new.category_id, new.title, new.script, new.note)
     is distinct from (old.date, old.category_id, old.title, old.script, old.note) then
    new.brief_updated_at := now();
  else
    new.brief_updated_at := old.brief_updated_at;
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

revoke execute on function public.clips_before_update() from public, anon, authenticated;
