-- Lock the columns of `profiles` the app is not meant to write.
--
-- The row-level policy was right — you can only update your own row — but the
-- table-level grant gave `authenticated` UPDATE and INSERT on all 28 columns.
-- So from the app, or from anything holding a user's session:
--
--   supabase.from('profiles').update({ energy_points: 999999, xp: 999999 }).eq('id', me)
--
-- minted currency and topped the leaderboard, and current_streak,
-- streak_freezes, owned_titles, xp_boost_expires_at and the rest were just as
-- open. Every server-side check added since — purchase_item's price lookup,
-- claim_streak_milestones, claim_weekly_quest — was one direct update away
-- from meaning nothing.
--
-- Row-level security cannot restrict columns; column grants can. The client now
-- keeps exactly the columns it writes (see AuthScreen's insert, EditProfileSheet,
-- WeightSheet, SplitSheet, ProfileScreen's photo, ShopScreen's equip). Everything
-- economic is written only by SECURITY DEFINER functions, which run as the
-- table owner and are unaffected by these grants.
--
-- Equipping stays a direct update, so it gets its own check: a trigger refuses
-- to equip a priced cosmetic the account does not own. Free items (price 0) and
-- values not sold in the shop at all ('Novice', the defaults) are always allowed.

revoke insert, update on public.profiles from anon, authenticated;

grant insert (id, first_name, sex, age, weight, height, workouts_per_week, goal, split, step_goal, avatar_url)
  on public.profiles to authenticated;

grant update (first_name, sex, age, weight, height, workouts_per_week, goal, split, step_goal, avatar_url,
              equipped_ring, equipped_avatar, equipped_badge, equipped_title)
  on public.profiles to authenticated;

-- Whether the caller may wear an item. Keyed to auth.uid(), so it cannot be
-- used to ask about anyone else's inventory.
create or replace function public.owns_cosmetic(p_item text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_item is null then true
    when not exists (select 1 from public.shop_items s where s.id = p_item and s.price > 0) then true
    when exists (select 1 from public.shop_items s where s.id = p_item and s.type = 'title')
      then coalesce((select p.owned_titles ? p_item from public.profiles p where p.id = auth.uid()), false)
    else exists (select 1 from public.user_inventory i where i.user_id = auth.uid() and i.item_id = p_item)
  end;
$$;

revoke all on function public.owns_cosmetic(text) from public, anon;
grant execute on function public.owns_cosmetic(text) to authenticated;

-- SECURITY INVOKER on purpose: current_user is then the API role for a direct
-- write and the owner for a write made inside a server function, which is how
-- the trigger tells the two apart.
create or replace function public.guard_profile_cosmetics()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if (new.equipped_ring   is distinct from old.equipped_ring   and not public.owns_cosmetic(new.equipped_ring))
  or (new.equipped_avatar is distinct from old.equipped_avatar and not public.owns_cosmetic(new.equipped_avatar))
  or (new.equipped_badge  is distinct from old.equipped_badge  and not public.owns_cosmetic(new.equipped_badge))
  or (new.equipped_title  is distinct from old.equipped_title  and not public.owns_cosmetic(new.equipped_title)) then
    raise exception 'not_owned' using errcode = '42501', hint = 'Buy the item before equipping it.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_cosmetics() from public, anon, authenticated;

drop trigger if exists guard_profile_cosmetics on public.profiles;
create trigger guard_profile_cosmetics
  before update on public.profiles
  for each row execute function public.guard_profile_cosmetics();
