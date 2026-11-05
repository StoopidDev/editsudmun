-- Nightly cleanup at 03:00 Asia/Bangkok (20:00 UTC).
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('purge-deleted-clips', '0 20 * * *', 'select public.purge_deleted_clips()');
select cron.schedule('purge-stale-media', '10 20 * * *', 'select public.purge_stale_media()');
