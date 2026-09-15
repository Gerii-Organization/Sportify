-- Group leaderboard (roadmap S5).
--
-- Ranks one group's members by what they did THIS WEEK, not by lifetime XP.
-- A lifetime board inside a small group is decided before anyone opens it:
-- whoever joined first stays first. A weekly one resets every Monday, so the
-- person who trained four times this week is on top of it.
--
-- workout_completions is private to its owner under RLS, so the counts have to
-- come from a SECURITY DEFINER function. What it gives away is deliberately
-- small: how many sessions and how many minutes this week, to people who share
-- a group with you. No exercises, no weights, no volume.
--
-- The week starts on Monday in the caller's time zone, the same `p_tz` the
-- workout and streak functions take, so the board flips at the caller's
-- midnight rather than at UTC's.

create or replace function public.get_group_leaderboard(p_group_id uuid, p_tz text default 'UTC')
returns table (
  id              uuid,
  first_name      text,
  xp              int,
  current_streak  int,
  equipped_avatar text,
  equipped_ring   text,
  equipped_badge  text,
  equipped_title  text,
  avatar_url      text,
  workouts_week   int,
  minutes_week    int
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  tz         text := coalesce(nullif(p_tz, ''), 'UTC');
  week_start timestamptz;
begin
  -- Not a member, not signed in: an empty board, not an error that confirms
  -- the group exists.
  if auth.uid() is null or not public.is_group_member(p_group_id, auth.uid()) then
    return;
  end if;

  begin
    week_start := date_trunc('week', now() at time zone tz) at time zone tz;
  exception when others then
    week_start := date_trunc('week', now());
  end;

  return query
  select
    p.id,
    p.first_name,
    coalesce(p.xp, 0)::int,
    coalesce(p.current_streak, 0)::int,
    p.equipped_avatar,
    p.equipped_ring,
    p.equipped_badge,
    p.equipped_title,
    p.avatar_url,
    coalesce(w.sessions, 0)::int,
    coalesce(w.minutes, 0)::int
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  left join lateral (
    select count(*) as sessions, sum(wc.duration_minutes) as minutes
      from public.workout_completions wc
     where wc.user_id = gm.user_id
       and wc.completed_at >= week_start
  ) w on true
  where gm.group_id = p_group_id
  order by coalesce(w.sessions, 0) desc, coalesce(w.minutes, 0) desc, coalesce(p.xp, 0) desc;
end;
$$;

revoke all on function public.get_group_leaderboard(uuid, text) from public, anon;
grant execute on function public.get_group_leaderboard(uuid, text) to authenticated;
