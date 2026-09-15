-- Achievements in tiers (roadmap G4): Bronze, Silver and Gold of one badge.
--
-- The twelve badges were already, in effect, three steps of a few ladders —
-- 1, 10 and 50 workouts; 3, 7 and 30 days — shown as twelve unrelated rows.
-- Grouping them by `family` with a `tier` turns them back into ladders, and
-- the families that stopped after one step get their silver and gold.
--
-- Awarding is unchanged: check_achievements still inserts every row whose
-- threshold is met, so a tier is simply an achievement. Rows, not code, so a
-- new tier is an INSERT.
--
-- Two metric fixes ride along:
--   volume   summed personal_records (one best set per exercise), so "Ten
--            Tonnes" measured the weight of your records, not what you lifted.
--            It now sums the sessions' total_volume_kg.
--   steps    daily_steps is written by the app; a day now counts for at most
--            60,000 so a forged row cannot hand out the gold tier.

alter table public.achievements add column if not exists family text;
alter table public.achievements add column if not exists tier text;

alter table public.achievements drop constraint if exists achievements_tier_check;
alter table public.achievements add constraint achievements_tier_check
  check (tier is null or tier in ('bronze', 'silver', 'gold'));

update public.achievements set family = 'workouts', tier = 'bronze' where code = 'first_workout';
update public.achievements set family = 'workouts', tier = 'silver' where code = 'workouts_10';
update public.achievements set family = 'workouts', tier = 'gold'   where code = 'workouts_50';
update public.achievements set family = 'streak',   tier = 'bronze' where code = 'streak_3';
update public.achievements set family = 'streak',   tier = 'silver' where code = 'streak_7';
update public.achievements set family = 'streak',   tier = 'gold'   where code = 'streak_30';
update public.achievements set family = 'level',    tier = 'bronze' where code = 'level_5';
update public.achievements set family = 'level',    tier = 'silver' where code = 'level_20';
update public.achievements set family = 'volume',   tier = 'bronze' where code = 'volume_10k';
update public.achievements set family = 'steps',    tier = 'bronze' where code = 'steps_100k';
update public.achievements set family = 'foods',    tier = 'bronze' where code = 'foods_25';
update public.achievements set family = 'friends',  tier = 'bronze' where code = 'social_3';

insert into public.achievements (code, name, description, icon, metric, threshold, sort_order, family, tier) values
  ('level_40',    'Legend',         'Reach level 40.',               'Crown',      'level',   40,      85,  'level',   'gold'),
  ('volume_50k',  'Fifty Tonnes',   'Lift 50,000 kg in total.',      'Trophy',     'volume',  50000,   91,  'volume',  'silver'),
  ('volume_250k', 'Mountain Mover', 'Lift 250,000 kg in total.',     'Trophy',     'volume',  250000,  92,  'volume',  'gold'),
  ('steps_500k',  'Marathoner',     'Walk 500,000 steps.',           'Footprints', 'steps',   500000,  101, 'steps',   'silver'),
  ('steps_2m',    'Globetrotter',   'Walk 2,000,000 steps.',         'Footprints', 'steps',   2000000, 102, 'steps',   'gold'),
  ('foods_100',   'Meal Tracker',   'Log 100 meals.',                'Target',     'foods',   100,     111, 'foods',   'silver'),
  ('foods_365',   'Nutrition Pro',  'Log 365 meals.',                'Target',     'foods',   365,     112, 'foods',   'gold'),
  ('social_10',   'The Crew',       'Make 10 friends.',              'Users',      'friends', 10,      121, 'friends', 'silver'),
  ('social_25',   'Squad Leader',   'Make 25 friends.',              'Users',      'friends', 25,      122, 'friends', 'gold')
on conflict (code) do update
  set name = excluded.name, description = excluded.description, icon = excluded.icon,
      metric = excluded.metric, threshold = excluded.threshold, sort_order = excluded.sort_order,
      family = excluded.family, tier = excluded.tier;

create or replace function public.check_achievements()
returns setof achievements
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  stats record;
begin
  if me is null then return; end if;

  select
    (select count(*) from workout_completions where user_id = me)                                  as workouts,
    (select coalesce(current_streak, 0) from profiles where id = me)                               as streak,
    (select coalesce(xp, 0) / 100 + 1 from profiles where id = me)                                 as level,
    (select coalesce(sum(total_volume_kg), 0) from workout_completions where user_id = me)          as volume,
    (select coalesce(sum(least(step_count, 60000)), 0) from daily_steps where user_id = me)         as steps,
    (select count(*) from scanned_foods where user_id = me)                                        as foods,
    (select count(*) from friendships
      where status = 'accepted' and (user_id = me or friend_id = me))                              as friends
  into stats;

  return query
  with earned as (
    insert into public.user_achievements (user_id, code)
    select me, a.code
      from public.achievements a
     where case a.metric
             when 'workouts' then stats.workouts
             when 'streak'   then stats.streak
             when 'level'    then stats.level
             when 'volume'   then stats.volume
             when 'steps'    then stats.steps
             when 'foods'    then stats.foods
             when 'friends'  then stats.friends
             else 0
           end >= a.threshold
    on conflict (user_id, code) do nothing
    returning code
  )
  select a.* from public.achievements a join earned e on e.code = a.code
  order by a.sort_order;
end $$;

-- The return type gains family and tier, which CREATE OR REPLACE cannot change.
drop function if exists public.get_achievement_progress();

create function public.get_achievement_progress()
returns table (
  code text, name text, description text, icon text, metric text, threshold numeric,
  sort_order integer, family text, tier text, current numeric, unlocked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me    uuid := auth.uid();
  stats record;
begin
  if me is null then return; end if;

  select
    (select count(*) from workout_completions where user_id = me)                                  as workouts,
    (select coalesce(current_streak, 0) from profiles where id = me)                               as streak,
    (select coalesce(xp, 0) / 100 + 1 from profiles where id = me)                                 as level,
    (select coalesce(sum(total_volume_kg), 0) from workout_completions where user_id = me)          as volume,
    (select coalesce(sum(least(step_count, 60000)), 0) from daily_steps where user_id = me)         as steps,
    (select count(*) from scanned_foods where user_id = me)                                        as foods,
    (select count(*) from friendships
      where status = 'accepted' and (user_id = me or friend_id = me))                              as friends
  into stats;

  return query
  select
    a.code, a.name, a.description, a.icon, a.metric, a.threshold, a.sort_order, a.family, a.tier,
    (case a.metric
       when 'workouts' then stats.workouts
       when 'streak'   then stats.streak
       when 'level'    then stats.level
       when 'volume'   then stats.volume
       when 'steps'    then stats.steps
       when 'foods'    then stats.foods
       when 'friends'  then stats.friends
       else 0
     end)::numeric as current,
    ua.unlocked_at
  from public.achievements a
  left join public.user_achievements ua
         on ua.code = a.code and ua.user_id = me
  order by a.sort_order;
end $$;

revoke all on function public.get_achievement_progress() from public, anon;
grant execute on function public.get_achievement_progress() to authenticated;
