-- Weekly quests (roadmap G3).
--
-- Four goals a week, reset on Monday in the player's time zone, each paying
-- energy and XP once when claimed. Daily quests on the dashboard are the
-- player's own to-do list and pay nothing; these are the app's, and they do.
--
-- Everything that decides a payout happens here. Progress is computed from
-- the tables at claim time, never sent by the app, and the primary key on
-- (user_id, week_start, quest_code) makes a second claim a no-op.
--
-- Where the source data is written by the client (daily_steps is an upsert the
-- app makes, water goes through add_water), the counting is capped so a forged
-- row is worth little: steps count up to 40,000 a day, a session counts toward
-- minutes for at most 180. The workouts quest only counts sessions of 15
-- minutes or more, so a burst of one-minute "workouts" does not finish it.
-- The rewards are sized with that in mind — a week of honest training earns
-- about what one mid-priced cosmetic costs, and nothing here can mint more.

create table if not exists public.weekly_quests (
  code        text primary key,
  title       text not null,
  description text not null,
  metric      text not null check (metric in ('workouts', 'minutes', 'steps', 'water_days')),
  target      int  not null check (target > 0),
  energy      int  not null default 0 check (energy >= 0),
  xp          int  not null default 0 check (xp >= 0),
  sort_order  int  not null default 0,
  active      boolean not null default true
);

insert into public.weekly_quests (code, title, description, metric, target, energy, xp, sort_order) values
  ('train_3',    'Train three times',   'Finish three workouts of 15 minutes or more.', 'workouts',   3,     150, 60, 1),
  ('active_150', '150 active minutes',  'Train for 150 minutes across the week.',        'minutes',    150,   120, 50, 2),
  ('steps_50k',  '50,000 steps',        'Walk 50,000 steps before Sunday ends.',          'steps',      50000, 100, 40, 3),
  ('water_5',    'Hydrated five days',  'Reach your water goal on five days.',            'water_days', 5,     80,  30, 4)
on conflict (code) do update
  set title = excluded.title, description = excluded.description, metric = excluded.metric,
      target = excluded.target, energy = excluded.energy, xp = excluded.xp, sort_order = excluded.sort_order;

alter table public.weekly_quests enable row level security;

drop policy if exists "Active weekly quests are readable" on public.weekly_quests;
create policy "Active weekly quests are readable"
  on public.weekly_quests for select
  to authenticated
  using (active);

create table if not exists public.weekly_quest_claims (
  user_id    uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  quest_code text not null references public.weekly_quests (code),
  energy     int  not null default 0,
  xp         int  not null default 0,
  claimed_at timestamptz not null default now(),
  primary key (user_id, week_start, quest_code)
);

alter table public.weekly_quest_claims enable row level security;

-- Read-only to the owner; written only by claim_weekly_quest.
drop policy if exists "Own weekly quest claims are readable" on public.weekly_quest_claims;
create policy "Own weekly quest claims are readable"
  on public.weekly_quest_claims for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Progress for one user and the current week. Internal: it takes a user id, so
-- it must never be callable from the API, or anyone could read anyone's week.
create or replace function public.weekly_quest_progress(p_user uuid, p_tz text)
returns table (code text, progress int, week_start date, resets_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  tz          text := coalesce(nullif(p_tz, ''), 'UTC');
  local_week  date;
  start_ts    timestamptz;
  n_workouts  int;
  n_minutes   int;
  n_steps     int;
  n_water     int;
begin
  begin
    local_week := date_trunc('week', now() at time zone tz)::date;
    start_ts   := local_week::timestamp at time zone tz;
  exception when others then
    tz         := 'UTC';
    local_week := date_trunc('week', now() at time zone 'UTC')::date;
    start_ts   := local_week::timestamp at time zone 'UTC';
  end;

  select count(*) filter (where wc.duration_minutes >= 15),
         coalesce(sum(least(wc.duration_minutes, 180)), 0)
    into n_workouts, n_minutes
    from public.workout_completions wc
   where wc.user_id = p_user
     and wc.completed_at >= start_ts;

  select coalesce(sum(least(ds.step_count, 40000)), 0)
    into n_steps
    from public.daily_steps ds
   where ds.user_id = p_user
     and ds.record_date >= local_week
     and ds.record_date < local_week + 7;

  -- 2500 ml is WATER_GOAL_ML in src/constants/content.js.
  select count(*)
    into n_water
    from public.daily_stats st
   where st.user_id = p_user
     and st.date >= local_week
     and st.date < local_week + 7
     and coalesce(st.water_ml, 0) >= 2500;

  return query
  select q.code,
         case q.metric
           when 'workouts'   then n_workouts
           when 'minutes'    then n_minutes
           when 'steps'      then n_steps
           when 'water_days' then n_water
           else 0
         end,
         local_week,
         (local_week + 7)::timestamp at time zone tz
    from public.weekly_quests q
   where q.active
   order by q.sort_order;
end;
$$;

revoke all on function public.weekly_quest_progress(uuid, text) from public, anon, authenticated;

create or replace function public.get_weekly_quests(p_tz text default 'UTC')
returns table (
  code        text,
  title       text,
  description text,
  metric      text,
  target      int,
  progress    int,
  energy      int,
  xp          int,
  claimed     boolean,
  week_start  date,
  resets_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select q.code, q.title, q.description, q.metric, q.target,
         least(p.progress, q.target), q.energy, q.xp,
         exists (
           select 1 from public.weekly_quest_claims c
            where c.user_id = auth.uid()
              and c.week_start = p.week_start
              and c.quest_code = q.code
         ),
         p.week_start, p.resets_at
    from public.weekly_quest_progress(auth.uid(), p_tz) p
    join public.weekly_quests q on q.code = p.code
   where auth.uid() is not null
   order by q.sort_order;
$$;

create or replace function public.claim_weekly_quest(p_code text, p_tz text default 'UTC')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me    uuid := auth.uid();
  quest public.weekly_quests;
  prog  record;
begin
  if me is null then
    return json_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  select * into quest from public.weekly_quests where code = p_code and active;
  if not found then
    return json_build_object('ok', false, 'reason', 'unknown_quest');
  end if;

  -- Serialises claims from one account, like the other reward functions.
  perform 1 from public.profiles where id = me for update;

  select * into prog from public.weekly_quest_progress(me, p_tz) wp where wp.code = p_code;
  if not found or prog.progress < quest.target then
    return json_build_object('ok', false, 'reason', 'not_complete',
                             'progress', coalesce(prog.progress, 0), 'target', quest.target);
  end if;

  insert into public.weekly_quest_claims (user_id, week_start, quest_code, energy, xp)
  values (me, prog.week_start, quest.code, quest.energy, quest.xp)
  on conflict (user_id, week_start, quest_code) do nothing;

  if not found then
    return json_build_object('ok', false, 'reason', 'already_claimed');
  end if;

  update public.profiles
     set energy_points = coalesce(energy_points, 0) + quest.energy,
         xp            = coalesce(xp, 0) + quest.xp
   where id = me;

  return json_build_object('ok', true, 'energy', quest.energy, 'xp', quest.xp);
end;
$$;

revoke all on function public.get_weekly_quests(text) from public, anon;
revoke all on function public.claim_weekly_quest(text, text) from public, anon;
grant execute on function public.get_weekly_quests(text) to authenticated;
grant execute on function public.claim_weekly_quest(text, text) to authenticated;
