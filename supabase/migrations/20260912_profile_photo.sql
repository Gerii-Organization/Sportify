-- Profile photos.
--
-- The app had avatars only as bought cosmetics: a coloured border around a
-- generic person glyph. There was no way to show your face, which is the first
-- thing anyone looks for on a profile — and the whole social half of the app
-- (feed, chats, leaderboard, friends) renders the same glyph for everybody.
--
-- The cosmetic border stays. It frames the photo instead of the glyph.

begin;

alter table public.profiles
  add column if not exists avatar_url text;

-- public_profiles is what other users read. Without the column here the photo
-- would exist and be invisible to everyone except its owner.
do $guard$
begin
  if not exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'public_profiles'
  ) then
    raise exception 'public.public_profiles does not exist; re-point this migration at whatever the app reads other people''s profiles from.';
  end if;
end
$guard$;

commit;

-- ---------------------------------------------------------------------------
-- RUN THIS PART BY HAND, after checking the existing definition:
--
--   select pg_get_viewdef('public.public_profiles', true);
--
-- The view has to be recreated with `avatar_url` added to its select list. It
-- is left out of the transaction above because replacing a view blindly would
-- drop whatever columns the current definition has, and this migration was
-- written without being able to read it.
-- ---------------------------------------------------------------------------

-- Storage for the files. Public read: an avatar is shown to everyone who can
-- see the profile, and signed URLs for something that public buys nothing.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- One folder per user. The path is <user-id>/avatar.jpg and is overwritten in
-- place, so changing your photo five times leaves one file rather than five.
drop policy if exists "avatars are readable by anyone" on storage.objects;
create policy "avatars are readable by anyone" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "users write their own avatar" on storage.objects;
create policy "users write their own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users replace their own avatar" on storage.objects;
create policy "users replace their own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete their own avatar" on storage.objects;
create policy "users delete their own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
