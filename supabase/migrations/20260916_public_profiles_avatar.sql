-- Profile photos on other people's profiles.
--
-- 20260912_profile_photo.sql added `profiles.avatar_url`, but `profiles` is
-- readable only by its owner. Everyone else reads `public_profiles`, and that
-- view did not select the new column — so your photo showed on your own
-- screens and a default avatar everywhere anyone else looked at you.
--
-- The select list is the live definition, unchanged and in the same order,
-- with `avatar_url` appended: CREATE OR REPLACE VIEW may only add columns at
-- the end. Grants survive a replace; they are restated anyway so this file
-- describes the whole contract.
--
-- Depends on 20260912_profile_photo.sql.

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar_url'
  ) then
    raise exception 'profiles.avatar_url is missing. Apply 20260912_profile_photo.sql first.';
  end if;
end $$;

create or replace view public.public_profiles
  with (security_invoker = false) as
  select p.id,
         p.first_name,
         p.xp,
         p.current_streak,
         p.workouts_per_week,
         p.equipped_avatar,
         p.equipped_ring,
         p.equipped_badge,
         p.equipped_title,
         p.created_at,
         p.avatar_url
    from public.profiles p;

revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

commit;
