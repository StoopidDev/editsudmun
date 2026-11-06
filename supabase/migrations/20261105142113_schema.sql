-- Tables for WebappClip. See docs/system-design.md §4 and the decisions in the backend plan.
-- Columns beyond the spec (color, status, revision_note, round, deleted_at, file_name,
-- uploader_name, ready_at, email) were agreed on 2026-11-05.

create extension if not exists pg_trgm with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'creator')),
  display_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  color text not null default '#757575' check (color ~ '^#[0-9a-fA-F]{6}$'),
  position int not null default 0
);

create table public.clips (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  position int not null default 0,
  category_id uuid not null references public.categories (id) on delete restrict,
  title text not null default '',
  script text not null default '',
  note text not null default '',
  status text not null default 'todo' check (status in ('todo', 'submitted', 'approved', 'revision')),
  revision_note text not null default '',
  round int not null default 1 check (round >= 1),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint revision_needs_note check (status <> 'revision' or length(trim(revision_note)) > 0)
);

create index clips_day_idx on public.clips (date, position) where deleted_at is null;
create index clips_category_idx on public.clips (category_id);
create index clips_created_by_idx on public.clips (created_by);
create index clips_updated_idx on public.clips (updated_at desc) where deleted_at is null;
create index clips_deleted_idx on public.clips (deleted_at) where deleted_at is not null;
-- Thai has no spaces between words, so search is substring ILIKE backed by trigram indexes.
create index clips_title_trgm on public.clips using gin (title extensions.gin_trgm_ops);
create index clips_script_trgm on public.clips using gin (script extensions.gin_trgm_ops);
create index clips_note_trgm on public.clips using gin (note extensions.gin_trgm_ops);

create table public.clip_media (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references public.clips (id) on delete cascade,
  kind text not null check (kind in ('image', 'video')),
  purpose text not null check (purpose in ('reference', 'submission')),
  r2_key text not null,
  file_name text not null check (length(file_name) between 1 and 255),
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  round int not null default 1 check (round >= 1),
  uploaded_by uuid references public.profiles (id) on delete set null,
  uploader_name text not null default '',
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  expires_at timestamptz not null,
  constraint ready_has_time check (status = 'pending' or ready_at is not null)
);

create index clip_media_clip_idx on public.clip_media (clip_id);
create index clip_media_uploaded_by_idx on public.clip_media (uploaded_by);
create index clip_media_pending_idx on public.clip_media (created_at) where status = 'pending';
create index clip_media_expires_idx on public.clip_media (expires_at);

-- Default categories (spec §10). Product data, so it lives in a migration and reaches prod too.
insert into public.categories (name, color, position) values
  ('รีวิว', '#6155f5', 0),
  ('คอนเทนต์', '#34c759', 1);
