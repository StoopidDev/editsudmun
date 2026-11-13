-- Indexes for the lists the frontend reads (Buddy handoff 2026-11-12 §2.5.6).
-- Already there: clips (date, position) where deleted_at is null (clips_day_idx) and
-- clips (brief_updated_at desc) where deleted_at is null (clips_brief_updated_idx).
-- The older clip_media_clip_idx (clip_id) and clip_media_expires_idx (expires_at) are covered by
-- the new ones and can be dropped later; kept for now (cheap at this size).

-- Home "needs attention": filters by status on live clips.
create index clips_status_idx on public.clips (status) where deleted_at is null;

-- Clip detail: media of one clip in upload order.
create index clip_media_clip_created_idx on public.clip_media (clip_id, created_at);

-- Expiring-files warning: only ready files are listed.
create index clip_media_expires_ready_idx on public.clip_media (expires_at) where status = 'ready';
