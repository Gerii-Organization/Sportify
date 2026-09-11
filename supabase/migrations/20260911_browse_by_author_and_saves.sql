-- Browse: search by author, and sort by how many people saved a workout.
--
-- The old `browse_workouts` searched the workout name only, and returned rows
-- in whatever order the table gave them. Two things were missing that people
-- actually look for: the person who wrote the plan, and whether anyone else
-- thought it was worth keeping.
--
-- Save count is computed here rather than stored on the row. A counter column
-- would need a trigger on every save and unsave, and any drift between the two
-- is permanent and invisible; counting is cheap at this size and cannot be
-- wrong.

-- Run as one transaction. Postgres DDL is transactional, so if the CREATE
-- below fails the DROP is rolled back with it — without this, a wrong table
-- name leaves Browse with no function at all rather than with the old one.
begin;

-- Fail loudly and early, before anything is dropped. The name of the saves
-- table was inferred from the existing toggle_saved_workout / get_saved_workouts
-- functions rather than read from the schema, so it is the one thing here that
-- could be wrong.
do $guard$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'saved_workouts'
  ) then
    raise exception
      'public.saved_workouts does not exist. Find the real table behind toggle_saved_workout and change every reference in this migration before running it.';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'blocks'
  ) then
    raise exception 'public.blocks does not exist; the block filter below will not compile.';
  end if;
end
$guard$;

drop function if exists public.browse_workouts(integer, text, text);
drop function if exists public.browse_workouts(integer, text, text, text);

create or replace function public.browse_workouts(
  p_limit  integer default 30,
  p_search text    default null,
  p_muscle text    default null,
  p_sort   text    default 'recent'   -- 'recent' | 'saves'
)
returns table (
  id           uuid,
  name         text,
  exercises    jsonb,
  cover_url    text,
  created_at   timestamptz,
  user_id      uuid,
  author_name  text,
  save_count   bigint,
  is_saved     boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with counted as (
    select
      w.id, w.name, w.exercises, w.cover_url, w.created_at, w.user_id,
      p.first_name as author_name,
      (select count(*) from public.saved_workouts s where s.workout_id = w.id) as save_count,
      exists (
        select 1 from public.saved_workouts s
        where s.workout_id = w.id and s.user_id = auth.uid()
      ) as is_saved
    from public.user_workouts w
    join public.public_profiles p on p.id = w.user_id
    where w.is_public = true
      -- Never your own: they are already in My workouts, and seeing them in
      -- Browse reads as a duplicate rather than as a listing.
      and w.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
      -- Blocks cut both ways.
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = w.user_id)
           or (b.blocker_id = w.user_id and b.blocked_id = auth.uid())
      )
      and (
        p_search is null
        or p_search = ''
        -- One box, both fields: someone typing a name does not know or care
        -- whether it is the workout's or the person's.
        or w.name ilike '%' || p_search || '%'
        or p.first_name ilike '%' || p_search || '%'
      )
      and (
        p_muscle is null
        or exists (
          select 1
          from jsonb_array_elements(w.exercises) ex
          where ex->>'muscle' = p_muscle
        )
      )
  )
  select *
  from counted
  order by
    case when p_sort = 'saves' then save_count end desc nulls last,
    created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

revoke all on function public.browse_workouts(integer, text, text, text) from public;
grant execute on function public.browse_workouts(integer, text, text, text) to authenticated;

commit;
