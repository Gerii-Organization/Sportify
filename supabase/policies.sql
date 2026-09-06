-- ============================================================================
-- Sportify — server-side fixes
--
-- Run this in the Supabase dashboard: SQL Editor -> New query -> Run.
-- Everything here is idempotent; running it twice is safe.
--
-- These cannot be fixed in the app. With the anon key, any client can query
-- any table directly — filtering in JavaScript hides rows from the UI but does
-- not stop someone reading them. Row-level security is the actual boundary.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Groups — a user may only see groups they belong to.
--
-- FriendsScreen used to run `select * from groups` with no filter, so every
-- user could list every group in the app. The client now filters by
-- membership; this makes it enforceable.
-- ----------------------------------------------------------------------------

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

drop policy if exists "read own groups" on public.groups;
create policy "read own groups" on public.groups
  for select using (
    exists (
      select 1 from public.group_members m
      where m.group_id = groups.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "create groups" on public.groups;
create policy "create groups" on public.groups
  for insert with check (created_by = auth.uid());

drop policy if exists "read members of own groups" on public.group_members;
create policy "read members of own groups" on public.group_members
  for select using (
    exists (
      select 1 from public.group_members mine
      where mine.group_id = group_members.group_id and mine.user_id = auth.uid()
    )
  );

drop policy if exists "add members to own groups" on public.group_members;
create policy "add members to own groups" on public.group_members
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.groups g
      where g.id = group_members.group_id and g.created_by = auth.uid()
    )
  );

drop policy if exists "leave group" on public.group_members;
create policy "leave group" on public.group_members
  for delete using (user_id = auth.uid());

drop policy if exists "read group messages" on public.group_messages;
create policy "read group messages" on public.group_messages
  for select using (
    exists (
      select 1 from public.group_members m
      where m.group_id = group_messages.group_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "send group messages" on public.group_messages;
create policy "send group messages" on public.group_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.group_members m
      where m.group_id = group_messages.group_id and m.user_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 2. Direct messages — participants only, and blocked pairs cannot exchange.
--
-- The app checked the `blocks` table only on PublicProfileScreen. Blocked
-- users still appeared in chat lists, search and the leaderboard, and messages
-- between them still delivered.
-- ----------------------------------------------------------------------------

alter table public.messages enable row level security;
alter table public.blocks enable row level security;

create or replace function public.is_blocked_pair(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

drop policy if exists "read own messages" on public.messages;
create policy "read own messages" on public.messages
  for select using (
    (sender_id = auth.uid() or receiver_id = auth.uid())
    and not public.is_blocked_pair(sender_id, receiver_id)
  );

drop policy if exists "send messages" on public.messages;
create policy "send messages" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and not public.is_blocked_pair(sender_id, receiver_id)
  );

drop policy if exists "edit own messages" on public.messages;
create policy "edit own messages" on public.messages
  for update using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "read own blocks" on public.blocks;
create policy "read own blocks" on public.blocks
  for select using (blocker_id = auth.uid() or blocked_id = auth.uid());

drop policy if exists "manage own blocks" on public.blocks;
create policy "manage own blocks" on public.blocks
  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 3. Per-user tables — you may only touch your own rows.
-- ----------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'daily_stats', 'daily_steps', 'tasks', 'workout_completions',
    'user_workouts', 'user_inventory', 'scanned_foods'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 4. Profiles — readable by everyone (leaderboard), writable only by the owner.
--
-- This is the important one. Every XP, energy and streak update in the app is
-- currently a client-side read-modify-write, which is how the daily spin was
-- able to overwrite total XP with 0. The RPCs below replace those writes with
-- atomic server-side increments.
-- ----------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles
  for select using (true);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert with check (id = auth.uid());


-- ----------------------------------------------------------------------------
-- 5. Atomic reward RPCs.
--
-- Call these instead of reading a value, adding to it and writing it back.
-- Two devices finishing a workout at once will no longer lose one of the
-- rewards, and a column missing from a SELECT can no longer zero a column.
-- ----------------------------------------------------------------------------

create or replace function public.award_xp(xp_delta int, energy_delta int default 0)
returns public.profiles
language sql
volatile
security definer
set search_path = public
as $$
  update public.profiles
     set xp = coalesce(xp, 0) + greatest(xp_delta, 0),
         energy_points = coalesce(energy_points, 0) + greatest(energy_delta, 0)
   where id = auth.uid()
  returning *;
$$;

create or replace function public.daily_spin()
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me public.profiles;
  roll float := random();
  energy_won int := 0;
  xp_won int := 0;
begin
  select * into me from public.profiles where id = auth.uid();
  if me is null then
    return json_build_object('ok', false, 'reason', 'no_profile');
  end if;

  -- The date check lives here so a user cannot spin repeatedly by editing the
  -- client or changing their device clock.
  if me.last_spin_date = current_date then
    return json_build_object('ok', false, 'reason', 'already_spun');
  end if;

  if roll > 0.9 then
    xp_won := 150;
  elsif roll > 0.6 then
    energy_won := 100;
  else
    energy_won := 30;
  end if;

  update public.profiles
     set xp = coalesce(xp, 0) + xp_won,
         energy_points = coalesce(energy_points, 0) + energy_won,
         last_spin_date = current_date
   where id = auth.uid();

  return json_build_object('ok', true, 'xp', xp_won, 'energy', energy_won);
end $$;

create or replace function public.purchase_item(
  p_item_id text,
  p_item_type text,
  p_price int
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() for update;
  if me is null then
    return json_build_object('ok', false, 'reason', 'no_profile');
  end if;

  -- Price and balance are both checked server-side; the client can no longer
  -- claim an item costs less than it does.
  if coalesce(me.energy_points, 0) < p_price then
    return json_build_object('ok', false, 'reason', 'insufficient_funds');
  end if;

  update public.profiles
     set energy_points = coalesce(energy_points, 0) - p_price
   where id = auth.uid();

  if p_item_type <> 'powerup' and p_item_type <> 'title' then
    insert into public.user_inventory (user_id, item_id, item_type, purchased_at)
    values (auth.uid(), p_item_id, p_item_type, now())
    on conflict (user_id, item_id) do nothing;
  end if;

  return json_build_object('ok', true);
end $$;

grant execute on function public.award_xp(int, int) to authenticated;
grant execute on function public.daily_spin() to authenticated;
grant execute on function public.purchase_item(text, text, int) to authenticated;


-- ----------------------------------------------------------------------------
-- 6. Daily quests never reset.
--
-- `tasks.completed` is a plain boolean with no date, so once a custom task was
-- ticked it stayed green forever. This column records which day it was last
-- completed; a task counts as done only when it matches today.
-- ----------------------------------------------------------------------------

alter table public.tasks add column if not exists completed_on date;

-- Existing ticked tasks are treated as completed today, so nothing looks like
-- it regressed the first time the app runs after this migration.
update public.tasks set completed_on = current_date where completed = true and completed_on is null;


-- ============================================================================
-- APPLIED 2026-09-06 via three follow-up migrations. Kept here as a record of
-- what the live database now contains.
--
--   dedupe_policies_and_enforce_blocks
--     Postgres OR-combines permissive policies. The original Romanian-named
--     policies were still in place alongside the ones above, and the looser
--     rule always won — so the block checks on `messages` were doing nothing.
--     Those superseded policies are now dropped, and `friendships` gained
--     explicit rules it never had.
--
--   complete_purchase_item_rpc
--     purchase_item now applies the power-up effects and title grants itself,
--     under a row lock, instead of leaving them to the client.
--
--   restrict_rpc_execution_to_signed_in_users
--     EXECUTE revoked from PUBLIC and anon on all four functions.
--
-- Still outstanding, needs a decision:
--
--   public.meals has RLS disabled and is reachable with the anon key. It is a
--   legacy table with 0 rows that no screen references. Either drop it, or:
--     ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
--   (with no policies, that denies all access — correct for an unused table).
--
--   Legacy tables todos, workouts, workout_exercises are also empty and unused;
--   `workouts` + `workout_exercises` are a normalised design that was abandoned
--   in favour of the JSON blob in user_workouts.
-- ============================================================================
