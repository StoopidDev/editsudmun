-- Owner RPCs run as the caller: RLS already lets the owner do each step, so they need no
-- elevated rights (advisor lint 0029). copy_clip still sets app.copying; the clip_media insert
-- trigger is security definer and honours it. is_owner() stays security definer on purpose:
-- policies call it, and reading profiles as the caller would recurse.
alter function public.copy_clip(uuid, date) security invoker;
alter function public.move_clip(uuid, int) security invoker;
alter function public.delete_category(uuid) security invoker;
