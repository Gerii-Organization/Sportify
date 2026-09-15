-- Seasons (roadmap G1): a leaderboard that resets every calendar month.
--
-- The all-time XP board is decided by whoever joined first. A season board
-- starts everyone at zero on the 1st, so someone who signed up last week can
-- top September.
--
-- Season points, from workout_completions only (which only complete_workout
-- writes):
--   10 points per distinct day trained (UTC)
--    1 point per 10 minutes, counting at most 240 minutes a day
-- The day term dominates on purpose: showing up is the thing being rewarded,
-- and splitting one session into ten calls earns nothing extra.
--
-- When a month ends, the first person to open the leaderboard settles it
-- (settle_last_season, idempotent): the top three earn energy and a title that
-- can only be won, never bought. Titles are strings in profiles.owned_titles,
-- like shop titles; season titles are listed in season_titles so the
-- equip check (owns_cosmetic) refuses them to anyone who did not win one.

create table if not exists public.season_titles (
  title text primary key
);

insert into public.season_titles (title) values
  ('Season Champion'), ('Season Runner-up'), ('Season Podium')
on conflict do nothing;

alter table public.season_titles enable row level security;
drop policy if exists "Season titles are readable" on public.season_titles;
create policy "Season titles are readable" on public.season_titles for select to authenticated using (true);

create table if not exists public.season_results (
  season   date not null,               -- first day of the month, UTC
  user_id  uuid not null references auth.users (id) on delete cascade,
  rank     int  not null check (rank between 1 and 3),
  score    int  not null,
  title    text not null references public.season_titles (title),
  energy   int  not null,
  primary key (season, user_id)
);

create table if not exists public.seasons_settled (
  season     date primary key,
  settled_at timestamptz not null default now()
);

alter table public.season_results enable row level security;
alter table public.seasons_settled enable row level security;

-- Results are public within the app: a season's podium is the point of it.
drop policy if exists "Season results are readable" on public.season_results;
create policy "Season results are readable" on public.season_results for select to authenticated using (true);

revoke insert, update, delete on public.season_titles, public.season_results, public.seasons_settled from anon, authenticated;

-- Points for one user in [p_from, p_to). Internal: takes a user id.
create or replace function public.season_points(p_user uuid, p_from timestamptz, p_to timestamptz)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(10 + floor(least(day_minutes, 240) / 10)), 0)::int
    from (
      select (wc.completed_at at time zone 'UTC')::date as day,
             sum(least(coalesce(wc.duration_minutes, 0), 180)) as day_minutes
        from public.workout_completions wc
       where wc.user_id = p_user and wc.completed_at >= p_from and wc.completed_at < p_to
       group by 1
    ) d;
$$;

revoke all on function public.season_points(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- Equipping: season titles need to have been won.
create or replace function public.owns_cosmetic(p_item text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_item is null then true
    when exists (select 1 from public.season_titles t where t.title = p_item)
      then coalesce((select p.owned_titles ? p_item from public.profiles p where p.id = auth.uid()), false)
    when not exists (select 1 from public.shop_items s where s.id = p_item and s.price > 0) then true
    when exists (select 1 from public.shop_items s where s.id = p_item and s.type = 'title')
      then coalesce((select p.owned_titles ? p_item from public.profiles p where p.id = auth.uid()), false)
    else exists (select 1 from public.user_inventory i where i.user_id = auth.uid() and i.item_id = p_item)
  end;
$$;

-- The current season's board: global top 50, or the caller and their friends.
create or replace function public.get_season_leaderboard(p_scope text default 'global')
returns table (
  id uuid, first_name text, xp int, current_streak int, equipped_avatar text, equipped_ring text,
  equipped_badge text, equipped_title text, avatar_url text, season_points int, rank bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  me     uuid := auth.uid();
  from_t timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
begin
  if me is null then return; end if;

  return query
  with pool as (
    select distinct wc.user_id as uid
      from public.workout_completions wc
     where wc.completed_at >= from_t
       and (
         p_scope <> 'friends'
         or wc.user_id = me
         or exists (
           select 1 from public.friendships f
            where f.status = 'accepted'
              and ((f.user_id = me and f.friend_id = wc.user_id) or (f.friend_id = me and f.user_id = wc.user_id))
         )
       )
  ),
  scored as (
    select pool.uid, public.season_points(pool.uid, from_t, now() + interval '1 second') as pts
      from pool
  )
  select p.id, p.first_name, coalesce(p.xp, 0)::int, coalesce(p.current_streak, 0)::int,
         p.equipped_avatar, p.equipped_ring, p.equipped_badge, p.equipped_title, p.avatar_url,
         s.pts, rank() over (order by s.pts desc)
    from scored s
    join public.profiles p on p.id = s.uid
   where s.pts > 0
   order by s.pts desc, p.first_name
   limit 50;
end;
$$;

-- The caller's place this season, time left, and last season's podium.
create or replace function public.get_my_season()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  from_t   timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  to_t     timestamptz := (date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC';
  my_pts   int;
  my_rank  int;
  last_s   date := (date_trunc('month', now() at time zone 'UTC') - interval '1 month')::date;
begin
  if me is null then
    return json_build_object('ok', false);
  end if;

  my_pts := public.season_points(me, from_t, to_t);

  select count(*) + 1 into my_rank
    from (
      select distinct user_id from public.workout_completions where completed_at >= from_t
    ) u
   where u.user_id <> me and public.season_points(u.user_id, from_t, to_t) > my_pts;

  return json_build_object(
    'ok', true,
    'season', (date_trunc('month', now() at time zone 'UTC'))::date,
    'ends_at', to_t,
    'points', my_pts,
    'rank', case when my_pts > 0 then my_rank else null end,
    'last_season', last_s,
    'podium', coalesce((
      select json_agg(json_build_object('rank', r.rank, 'first_name', p.first_name, 'user_id', r.user_id,
                                        'score', r.score, 'title', r.title, 'energy', r.energy) order by r.rank)
        from public.season_results r join public.profiles p on p.id = r.user_id
       where r.season = last_s
    ), '[]'::json)
  );
end;
$$;

-- Pays out last month's podium once. Anyone signed in may trigger it.
create or replace function public.settle_last_season()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  season_start date := (date_trunc('month', now() at time zone 'UTC') - interval '1 month')::date;
  from_t timestamptz := season_start::timestamp at time zone 'UTC';
  to_t   timestamptz := (season_start + interval '1 month')::timestamp at time zone 'UTC';
  winner record;
  titles constant text[] := array['Season Champion', 'Season Runner-up', 'Season Podium'];
  prizes constant int[]  := array[1000, 600, 300];
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  insert into public.seasons_settled (season) values (season_start) on conflict do nothing;
  if not found then
    return json_build_object('ok', true, 'settled', false);
  end if;

  for winner in
    select uid, pts, row_number() over (order by pts desc, first_seen) as place
      from (
        select wc.user_id as uid,
               public.season_points(wc.user_id, from_t, to_t) as pts,
               min(wc.completed_at) as first_seen
          from public.workout_completions wc
         where wc.completed_at >= from_t and wc.completed_at < to_t
         group by wc.user_id
      ) s
     where pts > 0
     order by pts desc, first_seen
     limit 3
  loop
    insert into public.season_results (season, user_id, rank, score, title, energy)
    values (season_start, winner.uid, winner.place, winner.pts, titles[winner.place], prizes[winner.place]);

    update public.profiles
       set energy_points = coalesce(energy_points, 0) + prizes[winner.place],
           owned_titles = case
             when coalesce(owned_titles, '[]'::jsonb) ? titles[winner.place] then owned_titles
             else coalesce(owned_titles, '[]'::jsonb) || to_jsonb(titles[winner.place])
           end
     where id = winner.uid;
  end loop;

  return json_build_object('ok', true, 'settled', true, 'season', season_start);
end;
$$;

revoke all on function public.get_season_leaderboard(text) from public, anon;
revoke all on function public.get_my_season() from public, anon;
revoke all on function public.settle_last_season() from public, anon;
grant execute on function public.get_season_leaderboard(text) to authenticated;
grant execute on function public.get_my_season() to authenticated;
grant execute on function public.settle_last_season() to authenticated;

-- Seasons start with the month they shipped in: every earlier month counts as
-- settled, so nobody is paid retroactively for a season that never ran.
insert into public.seasons_settled (season)
select (date_trunc('month', now() at time zone 'UTC') - make_interval(months => g))::date
  from generate_series(1, 24) g
on conflict do nothing;
