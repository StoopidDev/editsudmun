-- Grouped counts, so lists that only need numbers do not download one row per clip.
-- PostgREST caps a response at 1000 rows: at 50-70 clips a day the month view (and the category
-- page, which read every clip ever) came back truncated. Both run as the caller (RLS applies), so
-- a creator counts only what they can see.

-- Month view: clips per day and category in [p_from, p_to].
create function public.clip_day_counts(p_from date, p_to date)
returns table (date date, category_id uuid, n int)
language sql stable security invoker set search_path = '' as $$
  select c.date, c.category_id, count(*)::int
  from public.clips c
  where c.date between p_from and p_to and c.deleted_at is null
  group by c.date, c.category_id
$$;

-- Category page: live clips per category.
create function public.category_counts()
returns table (category_id uuid, n int)
language sql stable security invoker set search_path = '' as $$
  select c.category_id, count(*)::int
  from public.clips c
  where c.deleted_at is null
  group by c.category_id
$$;

revoke execute on function public.clip_day_counts(date, date), public.category_counts() from public, anon;
grant execute on function public.clip_day_counts(date, date), public.category_counts() to authenticated;
