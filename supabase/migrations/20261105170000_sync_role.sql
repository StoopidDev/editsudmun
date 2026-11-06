-- Auth's admin createUser inserts the user first and writes app_metadata/user_metadata in a
-- later update, so the insert trigger saw no role and defaulted to creator. Keep profiles in
-- sync when the metadata changes, and repair rows created before this fix.

create function public.handle_user_metadata() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data ->> 'role' in ('owner', 'creator')
     and new.raw_app_meta_data ->> 'role' is distinct from old.raw_app_meta_data ->> 'role' then
    update public.profiles set role = new.raw_app_meta_data ->> 'role' where id = new.id;
  end if;
  if nullif(trim(new.raw_user_meta_data ->> 'display_name'), '') is not null
     and new.raw_user_meta_data ->> 'display_name' is distinct from old.raw_user_meta_data ->> 'display_name' then
    update public.profiles set display_name = trim(new.raw_user_meta_data ->> 'display_name') where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_metadata_changed
after update of raw_app_meta_data, raw_user_meta_data on auth.users
for each row execute function public.handle_user_metadata();

revoke execute on function public.handle_user_metadata() from public, anon, authenticated;

-- Repair profiles created before this trigger existed.
update public.profiles p
set role = u.raw_app_meta_data ->> 'role'
from auth.users u
where u.id = p.id
  and u.raw_app_meta_data ->> 'role' in ('owner', 'creator')
  and p.role is distinct from u.raw_app_meta_data ->> 'role';

update public.profiles p
set display_name = trim(u.raw_user_meta_data ->> 'display_name')
from auth.users u
where u.id = p.id
  and nullif(trim(u.raw_user_meta_data ->> 'display_name'), '') is not null
  and p.display_name is distinct from trim(u.raw_user_meta_data ->> 'display_name');
