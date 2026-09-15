-- Streak milestones (roadmap G2).
--
-- Reaching 3, 7, 14, 30, 60 and 100 days in a row pays out once per account:
-- energy, and at some steps a Streak Freeze. Once, not once per streak: a
-- milestone is something you did, and letting it re-pay after every reset
-- would reward losing a streak and rebuilding it.
--
-- The rewards live in a table, not in the app, so the Streak screen reads the
-- same numbers the server pays and changing a reward needs no release.
--
-- Nothing here trusts the client. claim_streak_milestones reads the streak
-- that complete_workout wrote, under the profile row lock, and the primary key
-- on (user_id, days) makes a double claim a no-op rather than a double payout.

create table if not exists public.streak_milestone_rewards (
  days    int primary key check (days > 0),
  energy  int not null default 0 check (energy >= 0),
  freezes int not null default 0 check (freezes >= 0)
);

insert into public.streak_milestone_rewards (days, energy, freezes) values
  (3,    50, 0),
  (7,   150, 1),
  (14,  300, 0),
  (30,  600, 1),
  (60, 1000, 1),
  (100, 2000, 2)
on conflict (days) do update
  set energy = excluded.energy, freezes = excluded.freezes;

alter table public.streak_milestone_rewards enable row level security;

drop policy if exists "Milestone rewards are readable" on public.streak_milestone_rewards;
create policy "Milestone rewards are readable"
  on public.streak_milestone_rewards for select
  to authenticated
  using (true);

-- What was actually paid, which can be less than the reward row: freezes are
-- capped at three in reserve, the same cap the shop enforces.
create table if not exists public.streak_milestones (
  user_id    uuid not null references auth.users (id) on delete cascade,
  days       int  not null references public.streak_milestone_rewards (days),
  energy     int  not null default 0,
  freezes    int  not null default 0,
  claimed_at timestamptz not null default now(),
  primary key (user_id, days)
);

alter table public.streak_milestones enable row level security;

-- Read-only to the owner. There is deliberately no insert, update or delete
-- policy: rows are written only by the function below.
drop policy if exists "Own milestones are readable" on public.streak_milestones;
create policy "Own milestones are readable"
  on public.streak_milestones for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.claim_streak_milestones()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me            uuid := auth.uid();
  streak        int;
  in_reserve    int;
  r             record;
  paid_freezes  int;
  total_energy  int := 0;
  total_freezes int := 0;
  claimed       jsonb := '[]'::jsonb;
begin
  if me is null then
    return json_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  -- The row lock serialises two claims from the same account (two devices
  -- finishing at once), so the freeze cap below cannot be overshot.
  select coalesce(current_streak, 0), coalesce(streak_freezes, 0)
    into streak, in_reserve
    from public.profiles
   where id = me
     for update;

  if not found then
    return json_build_object('ok', false, 'reason', 'no_profile');
  end if;

  for r in
    select m.days, m.energy, m.freezes
      from public.streak_milestone_rewards m
     where m.days <= streak
       and not exists (
         select 1 from public.streak_milestones s
          where s.user_id = me and s.days = m.days
       )
     order by m.days
  loop
    paid_freezes := least(r.freezes, greatest(3 - in_reserve - total_freezes, 0));

    insert into public.streak_milestones (user_id, days, energy, freezes)
    values (me, r.days, r.energy, paid_freezes)
    on conflict (user_id, days) do nothing;

    if found then
      total_energy  := total_energy + r.energy;
      total_freezes := total_freezes + paid_freezes;
      claimed := claimed || jsonb_build_object('days', r.days, 'energy', r.energy, 'freezes', paid_freezes);
    end if;
  end loop;

  if total_energy > 0 or total_freezes > 0 then
    update public.profiles
       set energy_points  = coalesce(energy_points, 0) + total_energy,
           streak_freezes = coalesce(streak_freezes, 0) + total_freezes
     where id = me;
  end if;

  return json_build_object('ok', true, 'streak', streak, 'claimed', claimed);
end;
$$;

-- Supabase grants EXECUTE to anon explicitly, so revoking from public alone
-- would leave it callable signed out.
revoke all on function public.claim_streak_milestones() from public, anon;
grant execute on function public.claim_streak_milestones() to authenticated;
