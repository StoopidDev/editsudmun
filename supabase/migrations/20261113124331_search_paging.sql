-- Search without the inner 50-row cap: the client pages with .range() (Buddy handoff 2026-11-12
-- §2.5.2). id is added to the order so pages do not overlap when date and position tie.
-- create or replace keeps the existing grants (authenticated only).
create or replace function public.search_clips(p_q text) returns setof public.clips
language sql stable security invoker set search_path = '' as $$
  with q as (
    select '%' || replace(replace(replace(trim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select c.* from public.clips c, q
  where length(trim(p_q)) > 0
    and c.deleted_at is null
    and (c.title ilike q.pat or c.script ilike q.pat or c.note ilike q.pat)
  order by c.date desc, c.position, c.id
$$;
